# ES6 Module Server

Want to work with browser-native ECMAScript 6 modules, but still need dynamic `import` statements for config and localization?

As of May 2018, all four major web browsers allow you to natively work with ECMAScript modules, using `<script type="module">` to load your first JavaScript file and `import` to include other source files from it. You no longer need to muck around with bundlers and source maps when coding in modern JavaScript. But browser support comes with one major limitation: they can't run any kind of code before your `import` statements to figure out where the files live. Dynamic import statements like this will throw an error: ``import `/localized/${LANG}/strings.js` ``.

And secondly, while web browsers understand that module paths starting with `/`, like `import "/node_modules/my-module/foo.js"`, are relative to the _web root_; popular build tools like Closure Compiler treat them as if they’re relative to the root of the _filesystem_.

**ES6 Module Server** works around both issues by translating module names in realtime before serving them to your web browser. It will also translate an entire directory in advance, for deployment or bundling with any standard ES6 bundling tool.

This is good for:

 * Localization bundles for regions and languages
 * Environment-specific config files, with different values for development and production
 * Setting the root `/` directory for your project, and including external module libraries from `/node_modules`.

**This is not a transpiler or bundler.** It keeps your source intact exactly as written, only rewriting the _paths_ inside your import statements so web browsers and build tools know where to find your modules.

For example, when you load your boot HTML with `?lang=en-uk`, this will then translate `import "localized/strings.js"` to a relative path like `import "../../localized/en-uk/strings.js"`.

_For security, only file-safe values containing letters, numbers, `-`, and `_` will be read from URL query parameters._

## Installing

This uses Node and NPM. You also need to install the Express package to use this for a development server.

```
npm install express
npm install es6-module-server
```

## Configuration

The following configuration will map `locale` to the `lang` URL query parameter, and `environment` to the `env` parameter (with `en` and `dev` as the defaults when the parameters are missing). If you load your app with `?lang=fr`, it will then translate `import "localized/strings.js"` and `import "environment"` to  `import "./localized/fr/strings.js"` and `import "./env/config.dev.js"`, respectively.

The `variables` option is used only by the development server middleware to perform path translations in realtime, while `moduleSpecifiers` is used in both development and when preparing for release.

```js
module.exports = {
    // Location of source files relative to the project's root working directory
   baseDir:  "src/js",

   // Optional: the directory to resolve module paths starting with "/". Defaults to ".".
   rootDir: ".",

    // Used by the Express server middleware to determine
    // variables from the loading page's URL
    variables: {
        "locale": {
            type: "query",
            name: "lang",
            default: "en"
        },
        "environment": {
            type: "query",
            name: "env",
            default: "dev"
        }
    },

    // Used by both the Express Middleware and DirectoryConverter
    // to translate variables into paths
    moduleSpecifiers: {
        "localized": variables => `localized/${variables.locale}`,
        "environment": variables => `env/config.${variables.environment}.js`,
    }
};
```

Currently, only the `query` type is supported.


## Development Server

The development server (Node Express middleware) translates your module paths in realtime based on whatever variables (locales, environments, etc) you provide.

### Setting Variables

Using the above config file, to load your JavaScript with `"locale"` set to `"fr"`:

 * **Baked into your HTML, via `script` query parameters:** create an `index-fr.html` file, and add `?lang=fr` query parameter to your `script` tag's URL: `<script type="module" src="path/to/main.js?lang=fr"></script>`.
 * **Dynamically, via HTML query parameters:** create an `index.html` file that loads your base JavaScript with `<script type="module" src="path/to/main.js"></script>`. Then load it through the development server, appending `?lang=fr` to the URL.

### Setup

You can use this module's Node Express middleware to create your own development file server with a few lines of code. _It can be chained with other middleware to translate different file types as well._

This middleware is only intended for development use. For production, you should use the `DirectoryConverter` class (below) to translate your entire source tree in advance — and then, preferably, bundle and minify it.

_I recommend you use HTTPS even for development, though this sample only does HTTP for simplicity._

This has been tested with the most recent versions of **Safari** and **Chrome**.

```js
"use strict";

const express = require("express");
const es6ModuleMiddleware = require("es6-module-server/expressMiddleware.js");

const app = express();

// Your configuration file
const es6ModuleConfig = require("./es6-module-config.js");

app.use(`/${es6ModuleConfig.baseDir}`, es6ModuleMiddleware(es6ModuleConfig);

// Serve all other files not handled by the ES6 Module Middleware
// (including non-JavaScript files)
app.use(express.static("."));

app.listen(8080);

```

## Preparing Your Code For Release

The **DirectoryConverter** class tranlates an entire source directory.

You can use code like the following to create localized clones of your source. They can then be built by any ES6-compliant bundling tool like Closure Compiler, WebPack, and Babel, or hosted in raw format on a static web server.

JavaScript files in your source directory (ending in .js or .mjs) will have their import paths updated for the given configuration and locale. Import paths starting with `/`, such as `import Foo from "/node_modules/example/Foo.js"`, will be turned into relative paths using your `rootDir` configuration. All other file types will be copied as-is.

```js
const DirectoryConverter = require("es6-module-server/DirectoryConverter.js");

// Your configuration file
const es6ModuleConfig = require("./es6-module-config.js");

// Where to copy localized clones of it:
const dest_dir = "build/stage";

// What locales to build:
const locales = ["en", "fr"];

const converter = new DirectoryConverter(es6ModuleConfig);
for (let locale of locales) {
    converter.convertDirectory(
        // Destination directory:
        `${dest_dir}/${locale}`

        // The variable set for this directory:
        {
            "environment": "prod",
            "locale": locale,
        }
    );
}
```