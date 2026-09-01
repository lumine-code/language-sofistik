"""Characterization contract for the shipped TextMate grammar."""

from __future__ import annotations

import hashlib
import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
GRAMMAR_PATH = ROOT / "grammars" / "sofistik.json"
COMMANDS_PATH = ROOT / "commands"
HISTORICAL_MODULE_NAMES = {
    "DBME": "DBMERG",
    "STAR": "STAR2",
    "TUNA": "TUNARS",
}
HISTORICAL_STANDALONE_MODULES = {"TABLELAYOUT"}
EXPECTED_MODULE_ORDER = [
    "AQB",
    "AQUA",
    "ASE",
    "BDK",
    "BEAM",
    "BEMESS",
    "COLUMN",
    "CSM",
    "DBINFO",
    "DBMERG",
    "DBPRIN",
    "DECREATOR",
    "DOLFYN",
    "DSYNC",
    "DYNA",
    "DYNR",
    "ELLA",
    "FOOTING",
    "HASE",
    "HYDRA",
    "MAXIMA",
    "PLBCONVERTER",
    "RELY",
    "RESULTS",
    "SIR",
    "SOFILOAD",
    "SOFIMSHA",
    "SOFIMSHC",
    "STAR2",
    "TALPA",
    "TEMPLATE",
    "TENDON",
    "TEXTILE",
    "TUNARS",
    "WING",
    "FEABENCH",
    "FEACHECK",
    "SHEARWALL",
    "TABLELAYOUT",
    "CSA",
    "COMPOSITE",
]
EXPECTED_SEMANTIC_DIGEST = (
    "9fa5ba96a08935ac17162975d336fda6b6d121a0ea68564fe9b9d1585c36737e"
)
COMMAND_PATTERN = re.compile(r"\)\(([^()|?]+)\)\(\?=;\|\$\| \)$")


def load_grammar() -> dict:
    return json.loads(GRAMMAR_PATH.read_text(encoding="utf-8"))


def module_headers(grammar: dict) -> list[dict]:
    return [
        pattern
        for pattern in grammar["patterns"]
        if pattern.get("begin", "").startswith("(?i)^[ \\t]*([\\$\\+-]?PROG)")
    ]


def module_name(header: dict) -> str:
    return header["patterns"][0]["include"].removeprefix("#")


def command_name(pattern: dict) -> str | None:
    match = COMMAND_PATTERN.search(pattern.get("begin") or pattern.get("match") or "")
    return match.group(1) if match else None


class TextMateGrammarContractTests(unittest.TestCase):
    def test_keeps_the_complete_committed_highlight_contract(self):
        grammar = load_grammar()
        canonical = json.dumps(
            grammar,
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
        ).encode("utf-8")

        self.assertEqual(hashlib.sha256(canonical).hexdigest(), EXPECTED_SEMANTIC_DIGEST)
        self.assertEqual(grammar["scopeName"], "source.sofistik")
        self.assertEqual(grammar["fileTypes"], ["dat", "gra", "grb", "results"])
        self.assertEqual(
            [module_name(header) for header in module_headers(grammar)],
            EXPECTED_MODULE_ORDER,
        )

    def test_maps_source_catalogue_names_to_historical_program_names(self):
        source_modules = set()
        for path in sorted(COMMANDS_PATH.glob("sofistik.????.??.json")):
            source_modules.update(json.loads(path.read_text(encoding="utf-8")))
        source_modules.discard("BASIC")

        grammar = load_grammar()
        headers = {module_name(header): header for header in module_headers(grammar)}
        expected_modules = (
            source_modules.difference(HISTORICAL_MODULE_NAMES)
            | set(HISTORICAL_MODULE_NAMES.values())
            | HISTORICAL_STANDALONE_MODULES
        )

        self.assertEqual(set(headers), expected_modules)
        for source_name, historical_name in HISTORICAL_MODULE_NAMES.items():
            with self.subTest(source=source_name, historical=historical_name):
                self.assertIn(source_name, source_modules)
                self.assertNotIn(source_name, headers)
                self.assertIn(historical_name, grammar["repository"])
                self.assertEqual(
                    headers[historical_name]["name"],
                    f"module.{historical_name.lower()}.sofistik",
                )

    def test_preserves_the_standalone_tablelayout_program(self):
        grammar = load_grammar()
        commands = [
            name
            for pattern in grammar["repository"]["TABLELAYOUT"]["patterns"]
            if (name := command_name(pattern)) is not None
        ]

        self.assertEqual(
            commands,
            [
                "KOPF",
                "TXA",
                "TXE",
                "TXAB",
                "TXEB",
                "TXEN",
                "HELP",
                "STEU",
                "ENDE",
                "GNT",
                "GPL",
                "GPM",
                "GTXT",
                "GFA",
                "GGDP",
                "GSCA",
                "GCOL",
                "GPLI",
                "GPMI",
                "GTXI",
                "GFAI",
                "TVAR",
                "GAX",
                "GLBA",
                "GLBL",
                "ECHO",
                "SEIT",
                "UNIT",
                "TEST",
                "QUER",
                "HEAD",
                "TXB",
                "TXBB",
                "END",
                "SVAL",
                "PAGE",
                "CTRL",
            ],
        )


if __name__ == "__main__":
    unittest.main()
