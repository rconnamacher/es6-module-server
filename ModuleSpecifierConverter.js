"use strict";

const path = require("path");
const assert = require("assert");
const fs = require("fs");

const DEFAULT_OPTIONS = {
    variables: {},
    moduleSpecifiers: {},
}

const IMPORT_REGEX = /\bimport\s+([\w\s{},*]*\s+from\s+)?['"`]([^'"`\r\n]+)['"`]/g
const EXPORT_REGEX = /\bexport\s+[\w\s{},*]+\s+from\s+['"`]([^'"`\r\n]+)['"`]/g
const DYNAMIC_IMPORT_REGEX = /\bimport\s*\(\s*['"`]([^'"`\r\n]+)['"`]\s*\)/g

function getSpecifierReplacements(replacementFunction, variables) {
    let replacements;
    if (typeof replacementFunction === "function") {
        replacements = replacementFunction(variables);
    } else {
        replacements = replacementFunction;
    }
    if (!Array.isArray(replacements)) {
        replacements = [replacements];
    }
    for (const replacement of replacements) {
        if (typeof replacement !== "string") {
            throw new TypeError(`Module specifier must be a non-empty string, received ${typeof pattern}`);
        }
        if (!replacement) {
            throw new TypeError('Module specifier must be a non-empty string, received an empty string');
        }
    }
    return replacements;
}

module.exports = class ModuleSpecifierConverter {
    constructor(options) {
        options = Object.assign({}, DEFAULT_OPTIONS, options);

        this.options = Object.assign({
            rootDir: ".",
        }, options);

        this.specifiers = options.moduleSpecifiers;

        assert(options.baseDir && typeof options.baseDir === "string", "options.baseDir is required");
    }
    convert(jsSource, sourceFilePath, variables, additionalTransformFunc) {
        const specifiers = this.specifiers;
        const options = this.options;
        const baseDir = options.baseDir;
        const rootDir = options.rootDir;

        function rewriteModulePath(modulePath) {
            const specifier = modulePath.split("/", 1)[0];
            let modulePathCandidates = [modulePath];

            if (specifier === "" || specifier && specifier[0] !== "." && specifiers.hasOwnProperty(specifier)) {
                //console.log(`Specifier: ${specifier}`);

                if (specifier === "") {
                    // It starts with '/', resolve relative to rootDir
                    // (Defaults to current working directory if rootDir isn't set)
                    modulePathCandidates = [path.join(rootDir, modulePath)];
                    // modulePath = path.relative(path.dirname(destFilePath), modulePath);
                } else if (specifiers.hasOwnProperty(specifier)) {
                    // Named specifier, look for replacement pattern

                    let replacements = getSpecifierReplacements(specifiers[specifier], variables);
                    modulePathCandidates = replacements.map(
                        replacement => {
                            if (replacement.startsWith("/")) {
                                replacement = path.join(rootDir, replacement);
                            } else {
                                replacement = path.join(baseDir, replacement);
                            }
                            return modulePath.replace(specifier, replacement);
                        }
                    )
                }

                // Find first candidate that exists, or go with first if none exist
                modulePath = modulePathCandidates[0];
                for (const candidate of modulePathCandidates) {
                    if (fs.existsSync(candidate.split('?')[0])) {
                        modulePath = candidate;
                        break;
                    }
                }

                // Make relative to current file
                modulePath = path.relative(path.dirname(sourceFilePath), modulePath)
                if (modulePath[0] != ".") {
                    if (modulePath[0] != "/") {
                        modulePath = "/" + modulePath;
                    }
                    modulePath = "." + modulePath;
                }
            }

            if (additionalTransformFunc) {
                modulePath = additionalTransformFunc(modulePath);
            }

            return modulePath;
        }

        const rewriteImport = (importStatement, modulePath) => {
            const newModulePath = rewriteModulePath(modulePath);
            if (newModulePath !== modulePath) {
                importStatement = importStatement.replace(modulePath, newModulePath);
            }
            return importStatement;
        }

        return jsSource
            .replace(IMPORT_REGEX,
                (statement, _, modulePath) => rewriteImport(statement, modulePath),
            ).replace(EXPORT_REGEX,
                (statement, modulePath) => rewriteImport(statement, modulePath),
            ).replace(DYNAMIC_IMPORT_REGEX,
                (statement, modulePath) => rewriteImport(statement, modulePath),
            );
    }
}