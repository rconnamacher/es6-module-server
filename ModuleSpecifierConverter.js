"use strict";

const path = require("path");
const assert = require("assert");

const DEFAULT_OPTIONS = {
    variables: {},
    moduleSpecifiers: {},
}

const IMPORT_REGEX = /\bimport\s[^'"`\r\n]*['"`]([^'"`\r\n]+)['"`]/g;

module.exports = class ModuleSpecifierConverter {
    constructor(options) {
        options = Object.assign({}, DEFAULT_OPTIONS, options);

        this.options = Object.assign({
            rootDir: ".",
        }, options);

        this.specifiers = options.moduleSpecifiers;

        assert(options.baseDir && typeof options.baseDir === "string", "options.baseDir is required");
    }

    convert(jsSource, sourceFilePath, destFilePath, variables, additionalTransformFunc) {
        const specifiers = this.specifiers;
        const options = this.options;
        const baseDir = options.baseDir;
        const rootDir = options.rootDir;

        return jsSource.replace(IMPORT_REGEX, (importStatement, modulePath) => {
            const originalModulePath = modulePath;
            const specifier = modulePath.split("/", 1)[0];
            if (specifier === "" || specifier && specifier[0] !== "." && specifiers.hasOwnProperty(specifier)) {
                //console.log(`Specifier: ${specifier}`);

                if (specifier === "") {
                    // It starts with '/', resolve relative to rootDir
                    // (Defaults to current working directory if rootDir isn't set)
                    modulePath = path.join(rootDir, modulePath);
                    modulePath = path.relative(path.dirname(destFilePath), modulePath);
                } else if (specifiers.hasOwnProperty(specifier)) {
                    // Named specifier, look for replacement pattern
                    const replacement = specifiers[specifier](variables);
                    modulePath = modulePath.replace(specifier, path.join(baseDir, replacement));
                    modulePath = path.relative(path.dirname(sourceFilePath), modulePath);
                }

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

            if (originalModulePath !== modulePath) {
                importStatement = importStatement.replace(originalModulePath, modulePath);
            }

            return importStatement;
        });
    }
}