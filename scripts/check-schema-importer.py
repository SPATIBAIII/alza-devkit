"""Release acceptance in real Edge, including a real API process restart.

Start the production web server on localhost:3000; leave port 8000 free.
From apps/api: uv run --with playwright python ../../scripts/check-schema-importer.py
Uses an isolated SQLite database and writes evidence to a temporary directory.
"""
import csv
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
from io import BytesIO, StringIO
from zipfile import ZipFile

import httpx
from openpyxl import load_workbook
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = Path(tempfile.mkdtemp(prefix="alza-v030-acceptance-"))
API = "http://127.0.0.1:8000"
BASE = "/api/v1/schema-import"
results = []
process = None
log = (ARTIFACTS / "api.log").open("w", encoding="utf-8")


def passed(name):
    results.append(name)
    print(f"PASS {len(results)}: {name}", flush=True)


def start_api():
    global process
    env = {**os.environ, "DATA_FACTORY_DB": str(ARTIFACTS / "templates.sqlite3")}
    process = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
        cwd=ROOT / "apps/api", env=env, stdout=log, stderr=log,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
    )
    for _ in range(100):
        assert process.poll() is None, "API exited; see api.log"
        try:
            if httpx.get(f"{API}/api/v1/health", timeout=1).status_code == 200:
                return process.pid
        except httpx.TransportError:
            pass
        time.sleep(0.1)
    raise AssertionError("API did not become healthy")


def stop_api():
    if process is not None and process.poll() is None:
        process.terminate()
        process.wait(timeout=15)


def click(page, name):
    page.get_by_role("button", name=name, exact=True).click()


def download(page, label, filename):
    with page.expect_download() as event:
        click(page, label)
    item = event.value
    item.save_as(ARTIFACTS / filename)
    assert item.failure() is None
    return (ARTIFACTS / filename).read_bytes()


def integrity(data):
    assert data["total_records"] == sum(map(len, data["tables"].values()))
    for relationship in data["relationships"]:
        parents = {tuple(row[c] for c in relationship["target_columns"]) for row in data["tables"][relationship["target_table"]]}
        assert data["order"].index(relationship["target_table"]) < data["order"].index(relationship["source_table"])
        assert all(tuple(row[c] for c in relationship["source_columns"]) in parents for row in data["tables"][relationship["source_table"]])


def run(page):
    page.goto("http://localhost:3000")
    assert "Geist" in page.evaluate("getComputedStyle(document.body).fontFamily"), "Configured Geist font did not resolve"
    click(page, "Database Schema Importer")
    expect(page.get_by_role("button", name="Parse Schema", exact=True)).to_be_disabled()
    click(page, "Example Schema")
    click(page, "Parse Schema")
    expect(page.get_by_text("2 tables", exact=True)).to_be_visible()
    expect(page.get_by_text("9 columns", exact=True)).to_be_visible()
    expect(page.get_by_text("1 relationships", exact=True)).to_be_visible()
    expect(page.locator("tbody tr")).to_have_count(5)
    expect(page.get_by_title("Primary key")).to_be_visible()
    click(page, "public.enrollments")
    expect(page.get_by_text("FK", exact=True)).to_be_visible()
    expect(page.get_by_text("quantity >= 1", exact=False)).to_be_visible()
    click(page, "Inspect parent table")
    expect(page.get_by_role("heading", name="public.students", exact=True)).to_be_visible()
    passed("SQL paste/example parsing, table/type/key/CHECK inspection and parent navigation")

    click(page, "Configure generation")
    page.get_by_label("Rows for students", exact=True).fill("30")
    expect(page.get_by_role("combobox", name="first_name generator", exact=True)).to_have_value("first_name")
    page.get_by_role("combobox", name="first_name generator", exact=True).select_option("string")
    page.get_by_text("Generator options for first_name", exact=True).click()
    page.get_by_label("first_name Minimum length", exact=True).fill("6")
    page.get_by_label("first_name Maximum length", exact=True).fill("6")
    page.get_by_label("first_name Prefix", exact=True).fill("QA-")
    click(page, "public.enrollments")
    page.get_by_label("Rows for enrollments", exact=True).fill("60")
    expect(page.get_by_text("Relationship enforced:", exact=False)).to_be_visible()
    page.get_by_label("Configuration name", exact=True).fill("Release verification")
    page.get_by_label("Generation seed", exact=True).fill("73")
    click(page, "Validate Schema")
    expect(page.get_by_role("status")).to_contain_text("Schema and generation constraints are valid")
    click(page, "Save Configuration")
    expect(page.get_by_role("status")).to_have_text("Schema configuration saved.")
    saved = httpx.get(f"{API}{BASE}/schemas").json()
    assert len(saved) == 1
    saved_id = saved[0]["id"]
    passed("Mapping overrides/options, row counts, seed, validation and configuration save")

    click(page, "Continue to generate")
    click(page, "Generate Dataset")
    expect(page.get_by_text("90 synthetic records", exact=False)).to_be_visible()
    expect(page.locator("tbody tr")).to_have_count(25)
    click(page, "Next")
    expect(page.locator("tbody tr")).to_have_count(5)
    click(page, "Previous")
    first = page.locator("tbody tr").first.locator("td").all_text_contents()
    data = json.loads(download(page, "Download JSON", "dataset.json"))
    integrity(data)
    students, enrollments = data["order"]
    assert data["seed"] == 73 and data["total_records"] == 90
    assert list(map(str, data["tables"][students][0].values())) == first
    assert len({r["email"] for r in data["tables"][students]}) == 30
    assert all(r["first_name"].startswith("QA-") and len(r["first_name"]) == 9 for r in data["tables"][students])
    assert all(r["quantity"] >= 1 for r in data["tables"][enrollments])
    page.get_by_role("combobox", name="Preview table", exact=True).select_option(enrollments)
    expect(page.locator("thead th")).to_have_count(4)
    expect(page.get_by_text("Page 1 of 3", exact=True)).to_be_visible()
    click(page, "Generate Dataset")
    expect(page.get_by_role("status")).to_have_text("Dataset generated.")
    assert json.loads(download(page, "Download JSON", "repeat.json")) == data
    passed("Relationship-aware generation, PK/unique/CHECK integrity, mapping output, pagination and seeded repeatability")

    archive_bytes = download(page, "Download CSV ZIP", "dataset.zip")
    with ZipFile(BytesIO(archive_bytes)) as archive:
        manifest = json.loads(archive.read("manifest.json"))
        assert manifest["order"] == data["order"] and manifest["relationships"] == data["relationships"]
        assert len(archive.namelist()) == 3
        for key, filename in manifest["files"].items():
            raw = archive.read(filename)
            assert raw.startswith(b"\xef\xbb\xbf")
            rows = list(csv.DictReader(StringIO(raw.decode("utf-8-sig"))))
            assert rows == [{k: str(v) for k, v in row.items()} for row in data["tables"][key]]
    workbook = load_workbook(BytesIO(download(page, "Download Excel", "dataset.xlsx")))
    assert len(workbook.worksheets) == 2
    for key, sheet in zip(data["order"], workbook.worksheets):
        assert list(sheet.values)[0] == tuple(data["fields"][key])
        assert list(sheet.values)[1:] == [tuple(row.values()) for row in data["tables"][key]]
    workbook.close()
    passed("Actual JSON, CSV ZIP/manifest and Excel downloads match generated values across both tables")
    page.screenshot(path=str(ARTIFACTS / "desktop-generation.png"), full_page=True)

    old_pid = process.pid
    stop_api()
    assert process.poll() is not None
    try:
        httpx.get(f"{API}/api/v1/health", timeout=1)
    except httpx.TransportError:
        pass
    else:
        raise AssertionError("API still responds after process termination")
    click(page, "Generate Dataset")
    expect(page.locator("main [role=alert]")).to_contain_text("Could not reach")
    new_pid = start_api()
    assert old_pid != new_pid
    page.reload()
    click(page, "Database Schema Importer")
    click(page, "Saved schemas")
    expect(page.get_by_label(f"Rename {saved_id}", exact=True)).to_have_value("Release verification")
    click(page, "Open")
    click(page, "3. Configure")
    expect(page.get_by_label("Generation seed", exact=True)).to_have_value("73")
    expect(page.get_by_label("Rows for students", exact=True)).to_have_value("30")
    expect(page.get_by_role("combobox", name="first_name generator", exact=True)).to_have_value("string")
    click(page, "Continue to generate")
    click(page, "Generate Dataset")
    expect(page.get_by_role("status")).to_have_text("Dataset generated.")
    assert json.loads(download(page, "Download JSON", "after-restart.json")) == data
    (ARTIFACTS / "restart.json").write_text(json.dumps({"stopped_pid": old_pid, "new_pid": new_pid, "schema_id": saved_id, "records": 90, "identical_output": True}, indent=2))
    passed("Actual API termination, unavailable-service error, new API PID, browser reload and identical generation from persisted SQLite configuration")

    click(page, "3. Configure")
    page.get_by_label("Include this table", exact=True).uncheck()
    click(page, "Validate Schema")
    expect(page.locator("main [role=alert]")).to_contain_text("Select parent table")
    page.get_by_label("Include this table", exact=True).check()
    page.get_by_label("Rows for students", exact=True).fill("0")
    click(page, "Validate Schema")
    expect(page.locator("main [role=alert]")).to_contain_text("needs at least one record")
    page.get_by_label("Rows for students", exact=True).fill("30")
    page.get_by_role("combobox", name="id generator", exact=True).select_option("email")
    click(page, "Validate Schema")
    expect(page.locator("main [role=alert]")).to_contain_text("mapping cannot satisfy SQL type")
    page.get_by_role("combobox", name="id generator", exact=True).select_option("sequence")
    click(page, "Validate Schema")
    expect(page.get_by_role("status")).to_contain_text("constraints are valid")
    click(page, "4. Generate")
    expect(page.get_by_role("button", name="Download JSON", exact=True)).to_have_count(0)
    passed("Missing/unselected parents, zero parent rows, incompatible mappings, recovery and stale-preview invalidation")

    click(page, "Saved schemas")
    page.get_by_label(f"Rename {saved_id}", exact=True).fill("Renamed release config")
    click(page, "Rename")
    expect(page.get_by_role("status")).to_have_text("Schema renamed.")
    config = download(page, "Export configuration JSON", "configuration.json")
    assert json.loads(config)["name"] == "Renamed release config"
    page.get_by_label("Import configuration JSON", exact=True).set_input_files(ARTIFACTS / "configuration.json")
    expect(page.get_by_role("status")).to_have_text("Schema configuration imported.")
    click(page, "Saved schemas")
    expect(page.get_by_role("article")).to_have_count(2)
    ids = [s["id"] for s in httpx.get(f"{API}{BASE}/schemas").json()]
    assert len(set(ids)) == 2
    page.get_by_role("article").first.get_by_role("button", name="Delete", exact=True).click()
    expect(page.get_by_role("article")).to_have_count(1)
    click(page, "Delete")
    expect(page.get_by_text("No saved schemas.", exact=False)).to_be_visible()
    page.get_by_label("Import configuration JSON", exact=True).set_input_files({"name": "broken.json", "mimeType": "application/json", "buffer": b"{}"})
    expect(page.locator("main [role=alert]")).to_contain_text("tables")
    passed("Saved configuration rename/export/import with new identity/delete and invalid configuration rejection")

    click(page, "1. Import")
    for sql, error in [("DROP TABLE students;", "Unsupported statement"), ("CREATE TABLE x (id JSONB);", "Unsupported or undeclared"), ("CREATE TABLE broken (", "Unbalanced")]:
        page.get_by_label("SQL schema", exact=True).fill(sql)
        click(page, "Parse Schema")
        expect(page.locator("main [role=alert]")).to_contain_text(error)
    page.get_by_label("Upload SQL file", exact=True).set_input_files({"name": "wrong.txt", "mimeType": "text/plain", "buffer": b"select 1"})
    expect(page.locator("main [role=alert]")).to_contain_text("Choose a .sql file")
    page.get_by_label("Upload SQL file", exact=True).set_input_files({"name": "large.sql", "mimeType": "text/plain", "buffer": b" " * 262145})
    expect(page.locator("main [role=alert]")).to_contain_text("SQL exceeds 256 KB")
    passed("Malformed/unsupported/destructive SQL and invalid/oversized upload errors")

    sql = '''CREATE TYPE public.status AS ENUM ('active', 'inactive');
CREATE TABLE public.parents (a INTEGER, b INTEGER, status public.status DEFAULT 'active', PRIMARY KEY(a,b));
CREATE TABLE public.children (id SERIAL PRIMARY KEY, a INTEGER, b INTEGER);
ALTER TABLE public.children ADD CONSTRAINT parent_fk FOREIGN KEY (a,b) REFERENCES public.parents(a,b) ON DELETE CASCADE;'''
    page.get_by_label("Upload SQL file", exact=True).set_input_files({"name": "composite.sql", "mimeType": "text/plain", "buffer": sql.encode()})
    expect(page.get_by_role("status")).to_contain_text("SQL file loaded")
    click(page, "Parse Schema")
    page.get_by_text("Defaults and enum domains", exact=True).click()
    expect(page.get_by_text("DEFAULT 'active' (not evaluated)", exact=False)).to_be_visible()
    click(page, "4. Generate")
    click(page, "Generate Dataset")
    expect(page.get_by_role("status")).to_have_text("Dataset generated.")
    composite = json.loads(download(page, "Download JSON", "composite.json"))
    integrity(composite)
    assert len(composite["relationships"][0]["source_columns"]) == 2
    assert all(row["status"] in {"active", "inactive"} for row in composite["tables"][composite["order"][0]])
    passed("SQL file upload, enums/default inspection, ALTER constraint and composite tuple FK generation")

    click(page, "1. Import")
    page.get_by_label("SQL schema", exact=True).fill("CREATE TABLE cycle (id SERIAL PRIMARY KEY, parent INTEGER REFERENCES cycle(id));")
    click(page, "Parse Schema")
    click(page, "4. Generate")
    click(page, "Generate Dataset")
    expect(page.locator("main [role=alert]")).to_contain_text("Cyclic or self-referencing")
    passed("Self-referencing relationship rejection in the browser")

    for width in (390, 320):
        page.set_viewport_size({"width": width, "height": 844})
        page.reload()
        click(page, "Open navigation")
        click(page, "Database Schema Importer")
        click(page, "Example Schema")
        for step in ("import", "inspect", "configure", "generate", "saved"):
            if step == "inspect":
                click(page, "Parse Schema")
                expect(page.get_by_text("2 tables", exact=True)).to_be_visible()
            elif step == "configure":
                click(page, "Configure generation")
            elif step == "generate":
                click(page, "Continue to generate")
                click(page, "Generate Dataset")
                expect(page.get_by_role("status")).to_have_text("Dataset generated.")
                region = page.locator("table").locator("..")
                assert region.evaluate("el => el.scrollWidth > el.clientWidth")
                region.evaluate("el => el.scrollLeft = el.scrollWidth")
                assert region.evaluate("el => el.scrollLeft > 0")
                assert json.loads(download(page, "Download JSON", f"mobile-{width}.json"))["total_records"] == 200
            elif step == "saved":
                click(page, "Saved schemas")
            assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), f"Overflow at {width}px {step}"
            page.screenshot(path=str(ARTIFACTS / f"mobile-{width}-{step}.png"), full_page=True)
    passed("320px and 390px navigation, all five steps, generation/download, contained table scrolling and no page overflow")


try:
    with socket.socket() as probe:
        assert probe.connect_ex(("127.0.0.1", 8000)) != 0, "Port 8000 is occupied; stop your API before running this isolated check"
    print(f"Evidence: {ARTIFACTS}", flush=True)
    start_api()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel="msedge")
        print(f"Browser: Edge {browser.version}", flush=True)
        context = browser.new_context(viewport={"width": 1440, "height": 1000})
        context.tracing.start(screenshots=True, snapshots=True, sources=True)
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        try:
            run(page)
            assert not errors, errors
            passed("No uncaught browser JavaScript errors")
        except Exception:
            page.screenshot(path=str(ARTIFACTS / "failure.png"), full_page=True)
            raise
        finally:
            context.tracing.stop(path=str(ARTIFACTS / "trace.zip"))
            browser.close()
    for script in ("check-data-factory.py", "check-custom-dataset.py"):
        subprocess.run([sys.executable, str(ROOT / "scripts" / script)], cwd=ROOT, check=True)
        passed(f"Existing browser regression suite: {script}")
finally:
    stop_api()
    log.close()
    (ARTIFACTS / "results.json").write_text(json.dumps({"passed_groups": results}, indent=2), encoding="utf-8")
print(f"PASS: {len(results)} acceptance groups. Evidence: {ARTIFACTS}", flush=True)
