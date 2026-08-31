"""Focused tests for the source catalogue parser."""

import importlib.util
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("1_extract.py")
SPEC = importlib.util.spec_from_file_location("sofistik_extract", MODULE_PATH)
extractor = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(extractor)


class ExtractorTests(unittest.TestCase):
    def test_preserves_prefixed_placeholders_and_repeated_names(self):
        slots = extractor.extract_param_slots('"XXXX GAMA"APAR"SUP "FAT APAR')

        self.assertEqual([slot["position"] for slot in slots], list(range(1, 7)))
        self.assertEqual(slots[0]["name"], None)
        self.assertEqual(slots[0]["kind"], "placeholder")
        self.assertEqual(
            [(slot["name"], slot["kind"]) for slot in slots[1:]],
            [
                ("GAMA", "keyword"),
                ("APAR", "enum"),
                ("SUP", "enum"),
                ("FAT", "enum"),
                ("APAR", "keyword"),
            ],
        )

    def test_aligns_data_type_codes_by_source_column(self):
        slots = extractor.extract_param_slots('"OPT \'VAL  VAL2', start_column=8)
        line = "-*2" + " " * (slots[1]["_column"] - 3) + "9999"

        extractor.assign_data_types(slots, line)

        self.assertIsNone(slots[0]["dataTypeCode"])
        self.assertEqual(slots[1]["dataTypeCode"], "9999")
        self.assertIsNone(slots[2]["dataTypeCode"])

    def test_resolves_redirect_values_and_retains_provenance(self):
        schema = {
            "TEST": {
                "BASE": {
                    "slots": [
                        {
                            "position": 1,
                            "name": "TYPE",
                            "kind": "enum",
                            "dataTypeCode": None,
                            "enumValues": ["A", "B"],
                            "enumRedirect": None,
                        }
                    ]
                },
                "USE": {
                    "slots": [
                        {
                            "position": 1,
                            "name": "MODE",
                            "kind": "enum",
                            "dataTypeCode": None,
                            "enumValues": [],
                            "enumRedirect": {"command": "BASE", "item": "TYPE"},
                        }
                    ]
                },
            }
        }

        redirects, unresolved = extractor.resolve_enum_redirects(schema)

        self.assertEqual((redirects, unresolved), (1, 0))
        self.assertEqual(schema["TEST"]["USE"]["slots"][0]["enumValues"], ["A", "B"])
        self.assertEqual(
            schema["TEST"]["USE"]["slots"][0]["enumRedirect"],
            {"command": "BASE", "item": "TYPE"},
        )


if __name__ == "__main__":
    unittest.main()
