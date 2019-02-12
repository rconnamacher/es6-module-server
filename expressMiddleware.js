"use strict";

const fs = require("fs");
const path = require("path");
const {URL} = require("url");
const assert = require("assert");

const ModuleSpecifierConverter = require("./ModuleSpecifierConverter.js");

module.exports = function es6ModuleMiddleware(options) {
    const variableDefinitions = options.variables || {};
    const specifiers = options.moduleSpecifiers || {};
    const baseDir = options.baseDir;

    assert(baseDir && typeof baseDir === "string", "options.baseDir is required");

    const _isValidDirname = dirName => /^[\w-_][\w-_.]*$/.test(dirName);
    const _isJSFile = filePath => {
        const ext = path.extname(filePath);
        return ext === ".js" || ext === ".mjs";
    };
    function _urlPathToFilepath(filePath) {
        if (filePath[0] == "/") {
            filePath = filePath.substr(1);
        }
        return path.join(baseDir, filePath);
    }
    function getVariables(request) {
        const variables = {};
        const requestQuery = request.query;
        const referer = request.get("Referer");
        const refererURL = (referer && new URL(referer));
        const refererSearchParams = (refererURL && refererURL.searchParams);

        for (const varName of Object.keys(variableDefinitions)) {
            const definition = variableDefinitions[varName];
            let value;

            if (definition.type == "query") {
                if (definition.name in requestQuery) {
                    value = requestQuery[definition.name];
                } else if (refererSearchParams && refererSearchParams.has(definition.name)) {
                    value = refererSearchParams.get(definition.name);
                } else if (!referer) {
                    console.warn("Warning: no Referer header detected");
                }
            }

            if (!value || !_isValidDirname(value)) {
                value = definition.default;
            }

            variables[varName] = value;
        }
        return variables;
    }

    const moduleSpecifierConverter = new ModuleSpecifierConverter(options);

    return (request, response, next) => {
        if (request.method != "GET") {
            return next();
        }

        const urlPath = request.path;

        if (!_isJSFile(urlPath)) {
            return next();
        }

        const filePath = _urlPathToFilepath(urlPath);
        if (!fs.existsSync(filePath)) {
            return next();
        }

        const variables = getVariables(request);
        const definitions = variableDefinitions;

        let jsSource = fs.readFileSync(filePath, {encoding: "utf8"});
        jsSource = moduleSpecifierConverter.convert(
            jsSource, filePath, variables,

            // Add ?query parameter to module names
            modulePath => {
                let query = Object.keys(variables)
                    .filter(varName => definitions[varName].type == "query")
                    .map(varName => `${definitions[varName].name}=${variables[varName]}`)
                    .join("&");

                if (query) {
                    modulePath += (modulePath.includes("?") ? "&" : "?") + query;
                }
                return modulePath;
            }
        );

        response.type("js");
        response.set({
            "Expires": "0",
            "Cache-Control": "no-cache, no-store, must-revalidate",
        });
        response.status(200);
        response.send(jsSource);
    };
}
