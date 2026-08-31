"""Extract ordered command schemas from installed SOFiSTiK ``.err`` files.

The extractor writes two intermediate views for every release and language:

* ``sofistik.<release>.<language>.json`` keeps the historical parameter map
  consumed by ``3_merge.py``;
* ``sofistik.<release>.<language>.schema.json`` preserves every positional
  slot, including repeated names and placeholders, for syntax-aware clients.

The ``.err`` files are proprietary installation data. ``0_copyerr.py`` copies
them into ignored build directories; only the derived JSON is checked in.
"""

from __future__ import annotations

import copy
import json
import re
from collections import defaultdict
from pathlib import Path


VERSIONS = ["2018", "2020", "2022", "2023", "2024", "2025", "2026"]
LANGUAGES = ("de", "en")
MODULE_ALIASES = {
    "DBIN": "DBINFO",
    "MAXI": "MAXIMA",
    "TEMP": "TEMPLATE",
}

COMMAND_RE = re.compile(
    r"^-(10|20|\*0)(=|\s)([A-Z][A-Z0-9]{0,3})(?=[\s\'\"!]|$)(.*)$",
    re.IGNORECASE,
)
CONTINUATION_RE = re.compile(r"^-(10|20|\*0)\s{2,}(.+)$", re.IGNORECASE)
DATA_TYPE_RE = re.compile(r"^-(1|2|\*)2(?:\s|$)", re.IGNORECASE)
ENUM_RE = re.compile(
    r"^-(1|2|\*)([0-9A-F])([0-9A-Z])\s*(.*)$", re.IGNORECASE
)
DOC_RE = re.compile(r"^-(\*7|17|27)\s+([A-Z]{1,4})\s+(.*)$", re.IGNORECASE)
REDIRECT_RE = re.compile(
    r"^->\s*([A-Z][A-Z0-9_]{0,3})(?:\s*@\s*([A-Z][A-Z0-9]{0,3}))?\s*$",
    re.IGNORECASE,
)
PARAM_RE = re.compile(
    r"(?:(?P<prefix>[\"'`=!])"
    r"(?:(?P<prefixed_placeholder>XXXX|NONE|\.{4})|"
    r"(?P<prefixed_name>[A-Z][A-Z0-9_]{0,3})(?![A-Z0-9_])))|"
    r"(?<![A-Z0-9_])(?:(?P<placeholder>XXXX|NONE|\.{4})|"
    r"(?P<name>[A-Z][A-Z0-9_]{0,3})(?![A-Z0-9_]))",
    re.IGNORECASE,
)


def read_err_lines(filepath: Path) -> list[str]:
    """Read an error catalogue using the first encoding that decodes it."""

    for encoding in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            return filepath.read_text(encoding=encoding).splitlines()
        except UnicodeDecodeError:
            continue
    print(f"    Warning: could not decode {filepath}")
    return []


def mask_documentation(text: str) -> str:
    """Blank prose constructs without changing source columns."""

    for pattern in (r"\([^)]*\)", r"\[[^\]]*\]"):
        text = re.sub(pattern, lambda match: " " * len(match.group(0)), text)
    return text


def extract_param_slots(
    text: str, start_column: int = 0, start_position: int = 1
) -> list[dict]:
    """Return positional slots from one definition line.

    Slot names are deliberately not deduplicated. The private ``_column``
    value retains fixed-column alignment for the following ``-*2`` row and is
    removed before serialization.
    """

    slots = []
    masked = mask_documentation(text)
    for match in PARAM_RE.finditer(masked):
        placeholder = match.group("prefixed_placeholder") or match.group("placeholder")
        prefix = match.group("prefix") or ""
        matched_name = match.group("prefixed_name") or match.group("name")
        name = None if placeholder else matched_name.upper()

        if placeholder:
            kind = "placeholder"
        elif prefix == '"':
            kind = "enum"
        elif prefix == "'":
            kind = "literal"
        elif prefix == "`":
            kind = "comment"
        else:
            kind = "keyword"

        slots.append(
            {
                "position": start_position + len(slots),
                "name": name,
                "kind": kind,
                "dataTypeCode": None,
                "enumValues": set(),
                "enumRedirect": None,
                "_column": start_column + match.start(),
            }
        )
    return slots


def extract_enum_values(text: str) -> list[str]:
    """Extract enum tokens while preserving first-occurrence order."""

    values = []
    seen = set()
    masked = mask_documentation(text)
    for match in re.finditer(
        r"(?<![A-Z0-9_])([A-Z][A-Z0-9_]{0,3})(?![A-Z0-9_])",
        masked,
        re.IGNORECASE,
    ):
        value = match.group(1).upper()
        if value in {"XXXX", "NONE"} or re.fullmatch(r"F\d{2}", value):
            continue
        if value not in seen:
            values.append(value)
            seen.add(value)
    return values


def extract_bracket_enums(text: str) -> list[str]:
    """Extract the compact ``[A|B|C]`` enum form from help rows."""

    match = re.search(r"\[([^\]]+)\]", text)
    if not match:
        return []

    values = []
    seen = set()
    for item in match.group(1).split("|"):
        value = item.strip().upper()
        if not re.fullmatch(r"[A-Z][A-Z0-9]{0,3}", value):
            continue
        if value in {"XXXX", "NONE"} or value in seen:
            continue
        values.append(value)
        seen.add(value)
    return values


def command_template(name: str) -> dict:
    return {"de": name, "en": name, "slots_de": [], "slots_en": []}


def append_segment(command: dict, language: str, text: str, start_column: int) -> list[dict]:
    slots = command[f"slots_{language}"]
    segment = extract_param_slots(text, start_column, len(slots) + 1)
    slots.extend(segment)
    return segment


def target_slot(slots: list[dict], code: str) -> dict | None:
    """Resolve an enum row's final selector character to one slot."""

    code = code.upper()
    if code in "KLMNOPQRSTUVWXYZ":
        enum_index = ord(code) - ord("K")
        enum_slots = [slot for slot in slots if slot["kind"] == "enum"]
        return enum_slots[enum_index] if enum_index < len(enum_slots) else None

    if code in "GHIJ":
        position = ord(code) - ord("G") + 16
    else:
        try:
            position = int(code, 16)
        except ValueError:
            return None
    return next((slot for slot in slots if slot["position"] == position), None)


def assign_data_types(segment: list[dict], line: str) -> None:
    """Attach fixed-column ``-*2`` codes to the latest definition segment."""

    if not segment:
        return
    for match in re.finditer(r"(?<!\d)\d{4}(?!\d)", line[3:]):
        column = match.start() + 3
        candidates = [slot for slot in segment if slot["_column"] <= column]
        if candidates:
            max(candidates, key=lambda slot: slot["_column"])["dataTypeCode"] = match.group(0)


def language_targets(prefix: str) -> tuple[str, ...]:
    if prefix == "1":
        return ("de",)
    if prefix == "2":
        return ("en",)
    return LANGUAGES


def parse_err_file(filepath: Path | str) -> dict:
    """Parse one ``.err`` catalogue into paired German and English schemas."""

    filepath = Path(filepath)
    lines = read_err_lines(filepath)
    result = {"module": "", "version": "", "commands": {}}
    if not lines:
        return result

    header_match = re.match(r"^0000([A-Z0-9_]+?)\s*SOFiSTiK", lines[0], re.IGNORECASE)
    if header_match:
        result["module"] = header_match.group(1).upper()
    if len(lines) > 1:
        version_match = re.match(r"^0000VERSION\s+(\d+)", lines[1], re.IGNORECASE)
        if version_match:
            result["version"] = version_match.group(1)

    current_key = None
    last_segments = {"de": [], "en": []}

    for line in lines:
        command_match = COMMAND_RE.match(line)
        if command_match:
            language_code = command_match.group(1)
            command_name = command_match.group(3).upper()
            rest = command_match.group(4)

            if language_code == "10":
                current_key = command_name
                command = result["commands"].setdefault(current_key, command_template(command_name))
                command["de"] = command_name
                last_segments["de"] = append_segment(
                    command, "de", rest, command_match.start(4)
                )
                last_segments["en"] = []
            elif language_code == "20":
                if current_key is None:
                    current_key = command_name
                command = result["commands"].setdefault(current_key, command_template(command_name))
                command["en"] = command_name
                last_segments["en"] = append_segment(
                    command, "en", rest, command_match.start(4)
                )
            else:
                current_key = command_name
                command = result["commands"].setdefault(current_key, command_template(command_name))
                command["de"] = command_name
                command["en"] = command_name
                last_segments["de"] = append_segment(
                    command, "de", rest, command_match.start(4)
                )
                last_segments["en"] = append_segment(
                    command, "en", rest, command_match.start(4)
                )
            continue

        data_type_match = DATA_TYPE_RE.match(line)
        if data_type_match:
            for language in language_targets(data_type_match.group(1)):
                assign_data_types(last_segments[language], line)
            continue

        enum_match = ENUM_RE.match(line)
        if enum_match and current_key in result["commands"]:
            prefix = enum_match.group(1)
            selector = enum_match.group(3)
            body = enum_match.group(4).strip()
            redirect_match = REDIRECT_RE.match(body)
            enum_values = [] if redirect_match else extract_enum_values(body)
            command = result["commands"][current_key]

            for language in language_targets(prefix):
                slot = target_slot(command[f"slots_{language}"], selector)
                if slot is None:
                    continue
                if redirect_match:
                    item_name = redirect_match.group(1).upper()
                    redirect_command = redirect_match.group(2)
                    slot["enumRedirect"] = {
                        "command": (
                            redirect_command.upper() if redirect_command else command[language]
                        ),
                        "item": item_name,
                    }
                else:
                    slot["enumValues"].update(enum_values)
            continue

        doc_match = DOC_RE.match(line)
        if doc_match and current_key in result["commands"]:
            language_code, body = doc_match.group(1), doc_match.group(3)
            values = extract_bracket_enums(body)
            prefix = "*" if language_code == "*7" else language_code[0]
            command = result["commands"][current_key]
            for language in language_targets(prefix):
                for slot in command[f"slots_{language}"]:
                    if slot["name"] == "OPT":
                        slot["enumValues"].update(values)
            continue

        continuation_match = CONTINUATION_RE.match(line)
        if continuation_match and current_key in result["commands"]:
            language_code = continuation_match.group(1)
            body = continuation_match.group(2)
            command = result["commands"][current_key]
            if language_code == "10":
                last_segments["de"] = append_segment(
                    command, "de", body, continuation_match.start(2)
                )
            elif language_code == "20":
                last_segments["en"] = append_segment(
                    command, "en", body, continuation_match.start(2)
                )
            else:
                last_segments["de"] = append_segment(
                    command, "de", body, continuation_match.start(2)
                )
                last_segments["en"] = append_segment(
                    command, "en", body, continuation_match.start(2)
                )

    return result


def parse_all_err_files(errs_dir: Path | str) -> dict:
    """Parse every catalogue in a release directory."""

    commands = {}
    for err_file in sorted(Path(errs_dir).glob("*.err")):
        print(f"  Parsing {err_file.name}...")
        data = parse_err_file(err_file)
        module_name = data["module"] or err_file.stem.upper()
        module_name = MODULE_ALIASES.get(module_name, module_name)
        if data["commands"]:
            commands[module_name] = data["commands"]
    return commands


def serialize_slot(slot: dict) -> dict:
    return {
        "position": slot["position"],
        "name": slot["name"],
        "kind": slot["kind"],
        "dataTypeCode": slot["dataTypeCode"],
        "enumValues": sorted(slot["enumValues"]),
        "enumRedirect": copy.deepcopy(slot["enumRedirect"]),
    }


def build_language_schema(all_commands: dict, language: str) -> tuple[dict, set[str]]:
    """Build one localized schema and distribute SOFISTIK references."""

    modules = {}
    for module_name, commands in all_commands.items():
        modules[module_name] = {}
        for command in commands.values():
            localized_name = command[language]
            modules[module_name][localized_name] = {
                "slots": [serialize_slot(slot) for slot in command[f"slots_{language}"]]
            }

    sofistik = modules.get("SOFISTIK", {})
    filled = defaultdict(set)
    for module_name, commands in modules.items():
        if module_name == "SOFISTIK":
            continue
        for command_name, schema in list(commands.items()):
            if not schema["slots"] and command_name in sofistik and sofistik[command_name]["slots"]:
                commands[command_name] = copy.deepcopy(sofistik[command_name])
                filled[command_name].add(module_name)

    for command_name in filled:
        sofistik.pop(command_name, None)

    if "SOFISTIK" in modules:
        modules["BASIC"] = modules.pop("SOFISTIK")
    modules.setdefault("TEMPLATE", {})

    echo_schema = {
        "slots": [
            {
                "position": 1,
                "name": "OPT",
                "kind": "keyword",
                "dataTypeCode": None,
                "enumValues": [],
                "enumRedirect": None,
            },
            {
                "position": 2,
                "name": "VAL",
                "kind": "keyword",
                "dataTypeCode": None,
                "enumValues": [],
                "enumRedirect": None,
            },
        ]
    }
    for commands in modules.values():
        commands.setdefault("ECHO", copy.deepcopy(echo_schema))

    return modules, set(filled)


def find_redirect_values(schema: dict, module_name: str, redirect: dict) -> set[str] | None:
    """Find a redirect target in its module, then in BASIC."""

    command_name = redirect["command"]
    item_name = redirect["item"]
    command = schema.get(module_name, {}).get(command_name)
    if command is None:
        command = schema.get("BASIC", {}).get(command_name)
    if command is None:
        return None

    target_slots = [slot for slot in command["slots"] if slot["name"] == item_name]
    if not target_slots:
        return None
    return {value for slot in target_slots for value in slot["enumValues"]}


def resolve_enum_redirects(schema: dict) -> tuple[int, int]:
    """Resolve redirect chains while retaining their provenance."""

    redirect_slots = [
        (module_name, slot)
        for module_name, commands in schema.items()
        for command in commands.values()
        for slot in command["slots"]
        if slot["enumRedirect"] is not None
    ]

    for _ in range(len(redirect_slots) + 1):
        changed = False
        for module_name, slot in redirect_slots:
            values = find_redirect_values(schema, module_name, slot["enumRedirect"])
            if not values:
                continue
            merged = sorted(set(slot["enumValues"]) | values)
            if merged != slot["enumValues"]:
                slot["enumValues"] = merged
                changed = True
        if not changed:
            break

    unresolved = sum(not slot["enumValues"] for _module_name, slot in redirect_slots)
    return len(redirect_slots), unresolved


def collapse_schema(schema: dict) -> dict:
    """Derive the historical module/command/parameter map from ordered slots."""

    result = {}
    for module_name, commands in schema.items():
        result[module_name] = {}
        for command_name, command_schema in commands.items():
            params = {}
            for slot in command_schema["slots"]:
                name = slot["name"]
                if name is None:
                    continue
                params.setdefault(name, set()).update(slot["enumValues"])
            result[module_name][command_name] = {
                name: sorted(values) if values else None for name, values in params.items()
            }
    return result


def build_name_mapping(all_commands: dict) -> dict:
    mapping = {}
    for module_name, commands in all_commands.items():
        output_module = "BASIC" if module_name == "SOFISTIK" else module_name
        translations = {
            command["en"]: command["de"]
            for command in commands.values()
            if command["en"] != command["de"]
        }
        if translations:
            mapping[output_module] = translations
    return mapping


def write_json(filepath: Path, data: object) -> None:
    filepath.parent.mkdir(parents=True, exist_ok=True)
    filepath.write_text(
        json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )


def process_version(version: str, build_dir: Path, output_dir: Path) -> dict | None:
    """Extract both localized views for one installed release."""

    errs_dir = build_dir / version
    if not errs_dir.exists():
        print(f"  Skipping {version} - directory not found")
        return None

    print(f"\nProcessing version {version}...")
    all_commands = parse_all_err_files(errs_dir)
    if not all_commands:
        print(f"  No commands found for {version}")
        return None

    stats = {
        "modules": len(all_commands),
        "commands": sum(len(commands) for commands in all_commands.values()),
        "languages": {},
    }
    for language in LANGUAGES:
        schema, filled_commands = build_language_schema(all_commands, language)
        redirect_count, unresolved_count = resolve_enum_redirects(schema)
        commands = collapse_schema(schema)

        write_json(output_dir / f"sofistik.{version}.{language}.json", commands)
        write_json(output_dir / f"sofistik.{version}.{language}.schema.json", schema)

        slot_count = sum(
            len(command["slots"])
            for module in schema.values()
            for command in module.values()
        )
        stats["languages"][language] = {
            "slots": slot_count,
            "redirects": redirect_count,
            "unresolvedRedirects": unresolved_count,
            "filledCommands": len(filled_commands),
        }
        print(
            f"  {language.upper()}: {slot_count} slots, {redirect_count} redirects "
            f"({unresolved_count} unresolved), {len(filled_commands)} references filled"
        )

    write_json(output_dir / f"sofistik.{version}.names.json", build_name_mapping(all_commands))
    return stats


def main() -> dict:
    script_dir = Path(__file__).resolve().parent
    output_dir = script_dir / "extracted"

    print("SOFiSTiK Command and Schema Extractor")
    print("=" * 50)
    results = {}
    for version in VERSIONS:
        result = process_version(version, script_dir, output_dir)
        if result:
            results[version] = result

    print("\n" + "=" * 50)
    print("Summary:")
    for version, result in results.items():
        language_summary = ", ".join(
            f"{language.upper()} {stats['slots']} slots/{stats['unresolvedRedirects']} unresolved"
            for language, stats in result["languages"].items()
        )
        print(
            f"  {version}: {result['modules']} modules, {result['commands']} commands; "
            f"{language_summary}"
        )
    print("\nDone!")
    return results


if __name__ == "__main__":
    main()
