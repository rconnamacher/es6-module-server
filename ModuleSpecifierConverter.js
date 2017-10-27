"use strict";

const path = require("path");

const DEFAULT_OPTIONS = {
    variables: {},
    moduleSpecifiers: {},
}

const IMPORT_REGEX = /\bimport\s[^'"`\r\n]*['"`]([^'"`\r\n]+)['"`]/g;

module.exports = class ModuleSpecifierConverter {
    constructor(baseDir, options) {
        options = Object.assign({}, DEFAULT_OPTIONS, options);

        this.baseDir = baseDir;
        this.options = options;

        this.specifiers = options.moduleSpecifiers;
    }

    convert(jsSource, filePath, variables, additionalTransformFunc) {
        const specifiers = this.specifiers;
        const baseDir = this.baseDir;

        return jsSource.replace(IMPORT_REGEX, (importStatement, modulePath) => {
            const originalModulePath = modulePath;
            const specifier = modulePath.split("/", 1)[0];
            if (specifier && specifier[0] !== ".") {
                //console.log(`Specifier: ${specifier}`);
                if (specifiers.hasOwnProperty(specifier)) {
                    const replacement = specifiers[specifier](variables);
                    //console.log("Replacement: ", replacement);
                    const calculatedPath = modulePath.replace(specifier, path.join(baseDir, replacement));
                    //console.log(`Replacement in file ${filePath}, specifier=${specifier}`);

                    let relativePath = path.relative(path.dirname(filePath), calculatedPath);
                    if (relativePath[0] != ".") {
                        relativePath = "./" + relativePath;
                    }
                    modulePath = relativePath;
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