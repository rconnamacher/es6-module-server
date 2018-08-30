"use strict";

const path = require("path");
const klawSync = require("klaw-sync");
const fs = require("fs-extra");
const ModuleSpecifierConverter = require("./ModuleSpecifierConverter.js");

module.exports = class DirectoryConverter {
    constructor(options) {
        this.options = options;
        this.baseDir = options.baseDir;
    }

    convertDirectory(destDir, variables) {
        const options = Object.assign({
            rootDir: ".",
        }, this.options);
        const sourceDir = options.baseDir;

        const moduleSpecifierConverter = new ModuleSpecifierConverter(options);

        const inputFilePaths = klawSync(sourceDir, {
            nodir: true
        });

        const isJavaScriptFile = filePath => /^\.m?js$/.test(path.extname(filePath));

        for (let {path: filePath} of inputFilePaths) {
            const relativeFilePath = path.relative(sourceDir, filePath);
            const destinationFilePath = path.join(destDir, relativeFilePath);

            if (isJavaScriptFile(filePath)) {
                let jsSource = fs.readFileSync(filePath, {encoding: "utf8"});
                jsSource = moduleSpecifierConverter.convert(jsSource, filePath, destinationFilePath, variables);

                fs.ensureFileSync(destinationFilePath);
                fs.writeFileSync(destinationFilePath, jsSource);
            } else {
                fs.ensureDirSync(path.dirname(destinationFilePath));
                fs.copyFileSync(filePath, destinationFilePath);
            }
        }
    }
}