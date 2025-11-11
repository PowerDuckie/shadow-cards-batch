// Rollup configuration for shadow-cards-batch library
// Generates multiple module formats for maximum compatibility across environments

// Import required Rollup plugins
import commonjs from "@rollup/plugin-commonjs";    // Converts CommonJS modules to ES6
import terser from '@rollup/plugin-terser';        // Minifies output code
import resolve from '@rollup/plugin-node-resolve'; // Resolves external dependencies from node_modules

export default [
    // 1. ES Module output (for modern browsers and ESM-aware bundlers like Webpack/Rollup)
    {
        input: "src/index.js",  // Entry point of the library
        output: {
            name: "ShadowCard",   // Global variable name (fallback for UMD)
            file: "dist/index.esm.js",  // Output file path
            format: "es",         // ES module format (import/export syntax)
            sourcemap: true       // Generate source map for debugging
        },
        plugins: [
            resolve(),            // Resolve dependencies from node_modules
            commonjs(),           // Convert CommonJS dependencies to ES modules
            terser({              // Minify the output
                compress: {
                    dead_code: true   // Remove unreachable code
                },
                mangle: true,       // Shorten variable names
                output: {
                    comments: false   // Remove comments from minified output
                }
            })
        ]
    },

    // 2. CommonJS output (for Node.js environments and legacy bundlers)
    {
        input: "src/index.js",
        output: {
            name: "ShadowCard",
            file: "dist/index.cjs.js",  // CommonJS output file
            format: "cjs",              // CommonJS module format (require/module.exports)
            sourcemap: true
        },
        plugins: [
            resolve(),
            commonjs(),
            terser({
                compress: {
                    dead_code: true
                },
                mangle: true,
                output: {
                    comments: false
                }
            })
        ]
    },

    // 3. UMD output (Universal Module Definition - works in browsers and Node.js)
    {
        input: "src/index.js",
        output: {
            name: "ShadowCard",   // Global variable exposed in browser environments
            file: "dist/index.umd.js",  // UMD output file
            format: "umd",        // Universal format (works with AMD, CommonJS, and globals)
            sourcemap: true
        },
        plugins: [
            resolve(),
            commonjs(),
            terser({
                compress: {
                    dead_code: true
                },
                mangle: true,
                output: {
                    comments: false
                }
            })
        ]
    }
];