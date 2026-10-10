"""Framework-independent custom generation with bounded uniqueness attempts."""
import json
import random
from dataclasses import dataclass
from datetime import datetime, time, timedelta

from faker import Faker

from .field_registry import DATES, INTEGER, NUMERIC, REGISTRY, numeric_limits


def dependency_order(fields):
    by_name = {f.name: f for f in fields}
    if len(by_name) != len(fields):
        raise ValueError("Field names must be unique")
    ordered, visiting, done = [], set(), set()

    def visit(field):
        if field.name in visiting:
            raise ValueError("Circular computed field dependency")
        if field.name in done:
            return
        visiting.add(field.name)
        if field.computed:
            for source in field.computed.sources:
                if source not in by_name:
                    raise ValueError(f"Unknown source field: {source}")
                visit(by_name[source])
            sources = [by_name[s] for s in field.computed.sources]
            op = field.computed.operation
            if op == "multiply" and any(s.type not in NUMERIC and not (s.computed and s.computed.operation in {"multiply", "age"}) for s in sources):
                raise ValueError("Multiply requires numeric sources")
            if op == "age" and sources[0].type not in DATES:
                raise ValueError("Age requires a date source")
            if op == "age" and sources[0].options.max_date > field.computed.reference_date:
                raise ValueError("Birth date range must not exceed age reference date")
            if op == "full_name" and any(s.type not in {"string", "first_name", "last_name", "full_name"} for s in sources):
                raise ValueError("Full name requires string or name sources")
            if field.required and any(not s.required for s in sources):
                raise ValueError("Required computed fields require required sources")
        visiting.remove(field.name)
        done.add(field.name)
        ordered.append(field)

    for field in fields:
        visit(field)
    return ordered


@dataclass
class Context:
    rng: random.Random
    faker: Faker
    fallback: Faker


def generate_custom(request):
    from .custom_schemas import CustomDataset, GenerateRequest
    if not isinstance(request, GenerateRequest):
        request = GenerateRequest.model_validate(request)
    template, count = request.template, request.count
    ordered = dependency_order(template.fields)
    rng = random.Random(request.seed)
    faker = Faker(template.locale)
    faker.seed_instance(request.seed)
    fallback = Faker("en_US")
    fallback.seed_instance(request.seed)
    ctx = Context(rng, faker, fallback)
    # Decide nulls once. Uniqueness applies only to non-null values.
    nulls = {f.name: [not f.required and rng.random() < f.null_probability for _ in range(count)] for f in ordered}
    pools = {}
    for field in ordered:
        if field.computed:
            continue
        domain = 1 if field.default is not None else REGISTRY[field.type].domain(field)
        needed = count - sum(nulls[field.name])
        if domain == 0 or (field.unique and domain is not None and needed > domain):
            raise ValueError(f"Field '{field.name}': requested values exceed the available domain ({domain})")
        if field.unique and field.default is None and field.type in NUMERIC:
            low, high, scale = numeric_limits(field)
            pools[field.name] = iter([v if field.type in INTEGER else v / scale for v in rng.sample(range(low, high + 1), needed)])
        elif field.unique and field.default is None and field.type == "enum":
            values = list(field.options.values)
            weights = list(field.options.weights) if field.options.weights is not None else [1] * len(values)
            selected = []
            for _ in range(needed):
                chosen = rng.choices(range(len(values)), weights=weights, k=1)[0]
                selected.append(values.pop(chosen))
                weights.pop(chosen)
            pools[field.name] = iter(selected)
        elif field.unique and field.default is None and field.type in DATES:
            seconds = field.type == "datetime" and "H" in field.options.format
            base = datetime.combine(field.options.min_date, time())
            offsets = rng.sample(range(domain), needed)
            pools[field.name] = iter([(base + timedelta(seconds=v) if seconds else base + timedelta(days=v)).strftime(field.options.format) for v in offsets])
    seen = {f.name: set() for f in ordered}
    data, output_bytes, attempts = [], 0, 0
    by_name = {f.name: f for f in ordered}
    for index in range(count):
        row = {}
        for field in ordered:
            value = None
            if not nulls[field.name][index]:
                for _ in range(2000):
                    attempts += 1
                    if attempts > 150000:
                        raise ValueError("Generation exceeded the total attempt budget; relax uniqueness constraints")
                    if field.computed:
                        spec = field.computed
                        values = [row[s] for s in spec.sources]
                        if any(v is None for v in values):
                            value = None
                        elif spec.operation == "multiply":
                            value = round(values[0] * values[1], field.options.precision)
                            if abs(value) > 1e15:
                                raise ValueError(f"Field '{field.name}': computed value exceeds supported range")
                        elif spec.operation == "full_name":
                            value = " ".join(values)
                        else:
                            birth = datetime.strptime(values[0], by_name[spec.sources[0]].options.format).date()
                            ref = spec.reference_date
                            value = ref.year - birth.year - ((ref.month, ref.day) < (birth.month, birth.day))
                    elif field.name in pools:
                        value = next(pools[field.name])
                    else:
                        value = field.default if field.default is not None else REGISTRY[field.type].generate(ctx, field, index)
                    if isinstance(value, str) and len(value) > 1024:
                        raise ValueError(f"Field '{field.name}': value exceeds output limit")
                    if not field.unique or value is None or value not in seen[field.name]:
                        break
                    if field.computed or field.default is not None:
                        raise ValueError(f"Field '{field.name}': duplicate computed or default value")
                else:
                    raise ValueError(f"Field '{field.name}': uniqueness could not be satisfied within bounded attempts")
            if field.unique and value is not None:
                seen[field.name].add(value)
            row[field.name] = value
        row = {f.name: row[f.name] for f in template.fields}
        output_bytes += len(json.dumps(row, ensure_ascii=False).encode("utf-8"))
        if output_bytes > 10_000_000:
            raise ValueError("Dataset exceeds the 10 MB output limit")
        data.append(row)
    return CustomDataset(total_records=count, seed=request.seed, fields=[f.name for f in template.fields], data=data)
