"use strict";

const path = require("path");
const klawSync = require("klaw-sync");
const fs = require("fs-extra");
const ModuleSpecifierConverter = require("./ModuleSpecifierConverter.js");

module.exports = class DirectoryConverter {
    constructor(options) {
        this.options = options;
        this.baseDir = options.baseDir;

        this.moduleSpecifierConverter = new ModuleSpecifierConverter(options.baseDir, options);
    }

    convertDirectory(destDir, variables) {
        const sourceDir = this.baseDir;
        const filterFn = item => path.extname(item.path) === '.js';
        const inputFilePaths = klawSync(sourceDir, { filter: filterFn });
        const moduleSpecifierConverter = this.moduleSpecifierConverter;

        for (let {path: filePath} of inputFilePaths) {
            const relativeFilePath = path.relative(sourceDir, filePath);
            const destinationFilePath = path.join(destDir, relativeFilePath);

            //console.log(`Converting file path ${relativeFilePath} from ${filePath} to ${destinationFilePath}`);

            let jsSource = fs.readFileSync(filePath, {encoding: "utf8"});
            jsSource = moduleSpecifierConverter.convert(jsSource, filePath, variables);

            fs.ensureFileSync(destinationFilePath);
            fs.writeFileSync(destinationFilePath, jsSource);
        }
    }
}