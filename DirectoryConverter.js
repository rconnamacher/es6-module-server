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

        const isJavaScriptFile = filePath => /^\.m?jsx?$/.test(path.extname(filePath));

        for (let {path: filePath} of inputFilePaths) {
            const relativeFilePath = path.relative(sourceDir, filePath);
            const destinationFilePath = path.join(destDir, relativeFilePath);

            if (isJavaScriptFile(filePath)) {
                let jsSource = fs.readFileSync(filePath, {encoding: "utf8"});
                jsSource = moduleSpecifierConverter.convert(
                    jsSource, filePath, variables,

                    // modulePath will be a relative path between the two original files.
                    // Adjust it if that will break.
                    modulePath => {
                        const targetModule = path.resolve(path.dirname(filePath), modulePath);
                        const relativeFromSourceDir = path.relative(sourceDir, targetModule);
                        const isItOutsideSourceDir = relativeFromSourceDir.startsWith("../");

                        if (isItOutsideSourceDir) {
                            // It's pointing to a file outside the source directory (such as
                            // soemthing in /node_modules). The converted file will be moved,
                            // but target file will remain right where it is. Adjust path to
                            // keep it pointing to the right original file.
                            return path.relative(path.dirname(destinationFilePath), targetModule);
                        } else {
                            // It's pointing to another file in the same source directory,
                            // so the target file will be moved to staging along with this
                            // file. No changes are necessary.
                            return modulePath;
                        }
                    }
                );

                fs.ensureFileSync(destinationFilePath);
                fs.writeFileSync(destinationFilePath, jsSource);
            } else {
                fs.ensureDirSync(path.dirname(destinationFilePath));
                fs.copyFileSync(filePath, destinationFilePath);
            }
        }
    }
}