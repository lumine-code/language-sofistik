/**
 * SOFiSTiK Keywords Service Provider
 *
 * Provides programmatic access to SOFiSTiK keywords for other packages
 * and tools in the Lumine ecosystem.
 *
 * Supports version-specific and language-specific keyword loading with lazy caching.
 * Also provides version detection from file content and sofistik.def.
 */

const path = require("path");
const fs = require("fs");

/**
 * Keywords bound to one release and language
 * Created via SofistikKeywordsProvider.forRelease()
 */
class SofistikKeywordsContext {
  constructor(baseProvider, version, language) {
    this.base = baseProvider;
    // `defaultVersion` is the newest release keyword data ships for, which is
    // only known once meta.json has been read.
    baseProvider.loadMeta();
    this.version = baseProvider.normalizeVersion(version) || baseProvider.defaultVersion;
    this.language = baseProvider.normalizeLanguage(language) || baseProvider.defaultLanguage;
  }

  /**
   * Get the release these keywords are for
   * @returns {string} Version string
   */
  getVersion() {
    return this.version;
  }

  /**
   * Get the language these keywords are read in
   * @returns {string} Language code (en or de)
   */
  getLanguage() {
    return this.language;
  }

  /**
   * Get keywords for this context
   * @returns {Object} Complete keywords object organized by module
   */
  getKeywords() {
    return this.base.loadKeywords(this.version, this.language);
  }

  /**
   * Get keywords for a specific module
   * @param {string} moduleName - Name of the module (e.g., 'AQUA', 'SOFILOAD')
   * @returns {Object|null} Module keywords or null if not found
   */
  getModuleKeywords(moduleName) {
    const keywords = this.getKeywords();
    return keywords[moduleName] || null;
  }

  /**
   * Get all module names
   * @returns {string[]} Array of module names
   */
  getModuleNames() {
    const keywords = this.getKeywords();
    return Object.keys(keywords);
  }

  /**
   * Get all commands for a specific module
   * @param {string} moduleName - Name of the module
   * @returns {string[]} Array of command names
   */
  getModuleCommands(moduleName) {
    const module = this.getModuleKeywords(moduleName);
    return module ? Object.keys(module) : [];
  }

  /**
   * Get parameters object for a specific command
   * @param {string} moduleName - Name of the module
   * @param {string} commandName - Name of the command
   * @returns {Object|null} Params object {paramName: [enums] or null} or null if not found
   */
  getCommandKeywords(moduleName, commandName) {
    const module = this.getModuleKeywords(moduleName);
    return module && module[commandName] ? module[commandName] : null;
  }

  /**
   * Get the ordered input slots for a command.
   * @param {string} moduleName - Exact module containing the command
   * @param {string} commandName - Command name
   * @returns {{slots: Array}|null} Command schema or null when it is not present
   */
  getCommandSchema(moduleName, commandName) {
    const schemas = this.base.loadSchemas(this.version, this.language);
    const module = schemas[String(moduleName).toUpperCase()];
    return module?.[String(commandName).toUpperCase()] || null;
  }

  /**
   * Get parameter names for a specific command
   * @param {string} moduleName - Name of the module
   * @param {string} commandName - Name of the command
   * @returns {string[]} Array of parameter names
   */
  getCommandParams(moduleName, commandName) {
    const params = this.getCommandKeywords(moduleName, commandName);
    return params ? Object.keys(params) : [];
  }

  /**
   * Get enum values for a specific parameter
   * @param {string} moduleName - Name of the module
   * @param {string} commandName - Name of the command
   * @param {string} paramName - Name of the parameter
   * @returns {string[]|null} Array of enum values or null
   */
  getParamEnums(moduleName, commandName, paramName) {
    const params = this.getCommandKeywords(moduleName, commandName);
    if (params && paramName in params) {
      return params[paramName];
    }
    return null;
  }

  /**
   * Search for a keyword across all modules
   * @param {string} keyword - Keyword to search for
   * @returns {Object[]} Array of results with module, command, and type information
   */
  searchKeyword(keyword) {
    const keywords = this.getKeywords();
    const results = [];
    const searchTerm = keyword.toUpperCase();

    for (const [moduleName, module] of Object.entries(keywords)) {
      for (const [commandName, params] of Object.entries(module)) {
        if (commandName.toUpperCase().includes(searchTerm)) {
          results.push({
            module: moduleName,
            command: commandName,
            type: "command",
          });
        }

        if (params) {
          for (const paramName of Object.keys(params)) {
            if (paramName.toUpperCase().includes(searchTerm)) {
              results.push({
                module: moduleName,
                command: commandName,
                keyword: paramName,
                type: "param",
              });
            }
          }
        }
      }
    }

    return results;
  }

  /**
   * Validate if a word is a SOFiSTiK keyword
   * @param {string} word - Word to validate
   * @returns {Object|null} Match information or null if not a keyword
   */
  validateKeyword(word) {
    const keywords = this.getKeywords();
    const searchTerm = word.toUpperCase();

    for (const [moduleName, module] of Object.entries(keywords)) {
      if (module[searchTerm]) {
        return {
          module: moduleName,
          command: searchTerm,
          type: "command",
          params: module[searchTerm],
        };
      }

      for (const [commandName, params] of Object.entries(module)) {
        if (params && searchTerm in params) {
          return {
            module: moduleName,
            command: commandName,
            keyword: searchTerm,
            type: "param",
            enumValues: params[searchTerm],
          };
        }
      }
    }

    return null;
  }

  /**
   * Get statistics about the keywords
   * @returns {Object} Statistics object
   */
  getStatistics() {
    const keywords = this.getKeywords();

    const stats = {
      version: this.version,
      language: this.language,
      totalModules: 0,
      totalCommands: 0,
      totalSubKeywords: 0,
      moduleStats: {},
    };

    for (const [moduleName, module] of Object.entries(keywords)) {
      stats.totalModules++;
      const commandCount = Object.keys(module).length;
      const subKeywordCount = Object.values(module).reduce(
        (sum, params) => sum + (params ? Object.keys(params).length : 0),
        0,
      );

      stats.totalCommands += commandCount;
      stats.totalSubKeywords += subKeywordCount;

      stats.moduleStats[moduleName] = {
        commands: commandCount,
        subKeywords: subKeywordCount,
      };
    }

    return stats;
  }
}

class SofistikKeywordsProvider {
  constructor() {
    // Cache for transformed keywords: { "2026.en": {...}, "2025.de": {...} }
    this.cache = {};
    this.schemaCache = {};
    // Meta data cache
    this._meta = null;
    this.commandsPath = path.join(__dirname, "..", "commands");
    this.schemasPath = path.join(__dirname, "..", "schema");
    this.defaultVersion = "2026";
    this.defaultLanguage = "en";
    // Map config values to language codes
    this.languageMap = { english: "en", german: "de", en: "en", de: "de" };
  }

  /**
   * Keywords for one release and language.
   *
   * This package does not decide which release applies to a file — that is
   * `sofistik.environment`'s question, and it owns the setting, the installed
   * releases and the order they are consulted. Callers resolve there and ask
   * here, which is what stops two packages disagreeing about a file.
   * @param {string} version - Release year, e.g. "2026". Falls back to newest.
   * @param {string} language - "en"/"de", or "English"/"German". Defaults to en.
   * @returns {SofistikKeywordsContext} Keywords bound to that release
   */
  forRelease(version, language) {
    return new SofistikKeywordsContext(this, version, language);
  }

  /**
   * Load meta.json (lazy, cached)
   * @returns {Object} Meta data with versions list
   */
  loadMeta() {
    if (this._meta) return this._meta;

    const metaPath = path.join(this.commandsPath, "meta.json");
    try {
      if (fs.existsSync(metaPath)) {
        const data = fs.readFileSync(metaPath, "utf8");
        this._meta = JSON.parse(data);
        this.defaultVersion =
          this._meta.versions[this._meta.versions.length - 1] || this.defaultVersion;
        return this._meta;
      }
    } catch (error) {
      console.error("Error loading SOFiSTiK meta.json:", error);
    }

    this._meta = { versions: [] };
    return this._meta;
  }

  /**
   * Parse list params format into object format.
   * ["NO", "FCK", ["C20", "C25"], "ALFA"] -> {"NO": null, "FCK": ["C20", "C25"], "ALFA": null}
   * @param {Array} paramsList - Params in list format
   * @returns {Object} Params in object format {paramName: [enums] | null}
   */
  parseParamsList(paramsList) {
    const result = {};
    let i = 0;
    while (i < paramsList.length) {
      const item = paramsList[i];
      if (typeof item === "string") {
        if (i + 1 < paramsList.length && Array.isArray(paramsList[i + 1])) {
          result[item] = paramsList[i + 1];
          i += 2;
        } else {
          result[item] = null;
          i += 1;
        }
      } else {
        i += 1;
      }
    }
    return result;
  }

  /**
   * Normalize a release a caller asked for. "Auto" means the caller has not
   * decided, which here means the newest release data ships for.
   * @param {string|number} version - Version value from a caller
   * @returns {string|null} Four-digit version, or null for the default
   */
  normalizeVersion(version) {
    if (version === null || version === undefined) return null;
    const value = String(version).trim();
    if (!value || value.toLowerCase() === "auto") return null;
    return value;
  }

  /**
   * Normalize language value to code (en/de)
   * @param {string} lang - Language value from config or detection
   * @returns {string} Normalized language code (en or de)
   */
  normalizeLanguage(lang) {
    if (!lang) return null;
    return this.languageMap[lang.toLowerCase()] || null;
  }

  /**
   * Load keywords for a specific version and language (with caching)
   * Loads the per-version JSON file and converts list params to object format.
   * @param {string} version - SOFiSTiK version (2018, 2020, 2022, 2024, 2025, 2026)
   * @param {string} language - Language code (en, de)
   * @returns {Object} Keywords object: { MODULE: { CMD: { PARAM: [enums] | null } } }
   */
  loadKeywords(version, language) {
    version = version || this.defaultVersion;
    language = language || this.defaultLanguage;

    const cacheKey = `${version}.${language}`;

    if (this.cache[cacheKey]) {
      return this.cache[cacheKey];
    }

    const meta = this.loadMeta();

    if (!meta.versions.includes(version)) {
      console.warn(`SOFiSTiK version ${version} not found, falling back to ${this.defaultVersion}`);
      version = this.defaultVersion;
    }

    const filePath = path.join(this.commandsPath, `sofistik.${version}.${language}.json`);
    let rawData = {};

    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, "utf8");
        rawData = JSON.parse(data);
      }
    } catch (error) {
      console.error(`Error loading SOFiSTiK keywords (${version}.${language}):`, error);
    }

    // Convert list params to object format for API consumers
    const result = {};
    for (const [moduleName, moduleData] of Object.entries(rawData)) {
      result[moduleName] = {};
      for (const [cmdName, paramsList] of Object.entries(moduleData)) {
        result[moduleName][cmdName] =
          Array.isArray(paramsList) && paramsList.length > 0
            ? this.parseParamsList(paramsList)
            : {};
      }
    }

    this.cache[cacheKey] = result;
    return result;
  }

  /**
   * Load ordered command schemas for one release and language.
   * @param {string} version - SOFiSTiK release
   * @param {string} language - Language code (en, de)
   * @returns {Object} Module/command schema map
   */
  loadSchemas(version, language) {
    version = version || this.defaultVersion;
    language = language || this.defaultLanguage;
    const meta = this.loadMeta();

    if (!meta.versions.includes(version)) version = this.defaultVersion;
    const cacheKey = `${version}.${language}`;
    if (this.schemaCache[cacheKey]) return this.schemaCache[cacheKey];

    const filePath = path.join(this.schemasPath, `sofistik.${version}.${language}.json`);
    try {
      this.schemaCache[cacheKey] = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (error) {
      console.error(`Error loading SOFiSTiK schemas (${cacheKey}):`, error);
      this.schemaCache[cacheKey] = {};
    }
    return this.schemaCache[cacheKey];
  }

  /**
   * Get available versions
   * @returns {string[]} Array of available version strings
   */
  getAvailableVersions() {
    return this.loadMeta().versions;
  }

  /**
   * Clear the keywords cache
   */
  clearCache() {
    this.cache = {};
    this.schemaCache = {};
    this._meta = null;
  }
}

// Singleton instance
let providerInstance = null;

// Export the service provider
module.exports = {
  SofistikKeywordsProvider,
  SofistikKeywordsContext,

  /**
   * Create and return a keywords provider instance (singleton)
   * @returns {SofistikKeywordsProvider}
   */
  provideSofistikKeywords() {
    if (!providerInstance) {
      providerInstance = new SofistikKeywordsProvider();
    }
    return providerInstance;
  },

  /**
   * Get the singleton provider instance
   * @returns {SofistikKeywordsProvider|null}
   */
  getProvider() {
    return providerInstance;
  },
};
