const fs = require("fs");
const path = require("path");

describe("SOFiSTiK command schemas", () => {
  const schemaDirectory = path.join(__dirname, "..", "schema");
  const allowedKinds = new Set(["keyword", "literal", "enum", "comment", "placeholder"]);

  it("keeps every generated slot structurally valid", () => {
    const errors = [];
    const schemaFiles = fs
      .readdirSync(schemaDirectory)
      .filter((name) => /^sofistik\.\d{4}\.(?:de|en)\.json$/.test(name));

    expect(schemaFiles.length).toBe(14);
    for (const filename of schemaFiles) {
      const modules = JSON.parse(fs.readFileSync(path.join(schemaDirectory, filename), "utf8"));
      for (const [moduleName, commands] of Object.entries(modules)) {
        for (const [commandName, schema] of Object.entries(commands)) {
          const location = `${filename}:${moduleName}/${commandName}`;
          if (!Array.isArray(schema.slots)) {
            errors.push(`${location} has no slots array`);
            continue;
          }
          for (const [index, slot] of schema.slots.entries()) {
            if (slot.position !== index + 1)
              errors.push(`${location} has position ${slot.position}`);
            if (!allowedKinds.has(slot.kind)) errors.push(`${location} has kind ${slot.kind}`);
            if (slot.kind === "placeholder" && slot.name !== null) {
              errors.push(`${location} has a named placeholder ${slot.name}`);
            }
            if (slot.kind !== "placeholder" && typeof slot.name !== "string") {
              errors.push(`${location} has an unnamed ${slot.kind} slot`);
            }
            if (slot.name === "XXXX" || slot.name === "....") {
              errors.push(`${location} exposes placeholder ${slot.name} as an item`);
            }
            if (slot.dataTypeCode !== null && !/^\d{4}$/.test(slot.dataTypeCode)) {
              errors.push(`${location} has data type ${slot.dataTypeCode}`);
            }
            if (!Array.isArray(slot.enumValues)) errors.push(`${location} has invalid enum values`);
            if (slot.enumRedirect !== null) {
              if (
                typeof slot.enumRedirect?.command !== "string" ||
                typeof slot.enumRedirect?.item !== "string"
              ) {
                errors.push(`${location} has an invalid enum redirect`);
              }
            }
          }
        }
      }
    }

    expect(errors).toEqual([]);
  });

  it("reports the sole catalogue redirect whose target has no enum values", () => {
    const meta = JSON.parse(fs.readFileSync(path.join(schemaDirectory, "meta.json"), "utf8"));
    expect(Object.values(meta.unresolvedRedirects)).toEqual(Array(14).fill(1));

    const schema = JSON.parse(
      fs.readFileSync(path.join(schemaDirectory, "sofistik.2026.en.json"), "utf8"),
    );
    const unresolved = [];
    for (const [moduleName, commands] of Object.entries(schema)) {
      for (const [commandName, commandSchema] of Object.entries(commands)) {
        for (const slot of commandSchema.slots) {
          if (slot.enumRedirect && slot.enumValues.length === 0) {
            unresolved.push({
              moduleName,
              commandName,
              name: slot.name,
              redirect: slot.enumRedirect,
            });
          }
        }
      }
    }

    expect(unresolved).toEqual([
      {
        moduleName: "SOFIMSHA",
        commandName: "QUAD",
        name: "KR",
        redirect: { command: "BEAM", item: "KR" },
      },
    ]);
  });

  it("keeps localized PAGE as a universal BASIC command in every release", () => {
    const schemaFiles = fs
      .readdirSync(schemaDirectory)
      .filter((name) => /^sofistik\.\d{4}\.(?:de|en)\.json$/.test(name));

    for (const filename of schemaFiles) {
      const language = filename.endsWith(".de.json") ? "de" : "en";
      const commandName = language === "de" ? "SEIT" : "PAGE";
      const itemName = language === "de" ? "UNIE" : "UNII";
      const modules = JSON.parse(fs.readFileSync(path.join(schemaDirectory, filename), "utf8"));
      const command = modules.BASIC?.[commandName];

      expect(command).toBeTruthy();
      expect(command.slots.length).toBeGreaterThan(0);
      expect(command.slots.map((slot) => slot.name)).toContain(itemName);
    }
  });
});
