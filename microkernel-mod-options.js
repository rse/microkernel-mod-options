/*
**  Microkernel -- Microkernel for Server Applications
**  Copyright (c) 2015-2016 Ralf S. Engelschall <rse@engelschall.com>
**
**  Permission is hereby granted, free of charge, to any person obtaining
**  a copy of this software and associated documentation files (the
**  "Software"), to deal in the Software without restriction, including
**  without limitation the rights to use, copy, modify, merge, publish,
**  distribute, sublicense, and/or sell copies of the Software, and to
**  permit persons to whom the Software is furnished to do so, subject to
**  the following conditions:
**
**  The above copyright notice and this permission notice shall be included
**  in all copies or substantial portions of the Software.
**
**  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
**  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
**  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
**  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
**  CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
**  TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
**  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

/*  internal requirements  */
import path     from "path"

/*  external requirements  */
import ini      from "node-ini"
import dashdash from "dashdash"
import sprintf  from "sprintfjs"

/*  the Microkernel module  */
export default class Module {
    constructor (options) {
        this.options = Object.assign({
            inifile: ""
        }, options)
    }
    get module () {
        return {
            name:  "microkernel-mod-options",
            tag:   "OPTIONS",
            group: "BOOT",
            after: "CTX"
        }
    }
    configure (kernel) {
        /*  determine virtual command-line arguments (step 1/3)  */
        let k = 0
        let argv = []
        argv.push(process.argv[k++])
        argv.push(process.argv[k++])

        /*  determine virtual command-line arguments (step 2/3)  */
        let inifile = kernel.hook("options:inifile", "pass", this.options.inifile)
        let sections = [ "default" ]
        if (k < process.argv.length) {
            let m = process.argv[k].match(/^--options=(?:([^:]+):)?(.+)$/)
            if (m !== null) {
                if (m[1])
                    inifile = m[1]
                sections.push(m[2])
                k++
            }
        }
        if (inifile !== "") {
            let config = ini.parseSync(inifile)
            for (let j = 0; j < sections.length; j++) {
                if (typeof config[sections[j]] !== "undefined") {
                    for (let name in config[sections[j]]) {
                        if (config[sections[j]].hasOwnProperty(name)) {
                            if (typeof config[sections[j]][name] === "string") {
                                if (   config[sections[j]][name] === "true"
                                    || config[sections[j]][name] === "false") {
                                    if (config[sections[j]][name] === "true")
                                        argv.push("--" + name)
                                }
                                else {
                                    argv.push("--" + name)
                                    argv.push(config[sections[j]][name])
                                }
                            }
                            else if (config[sections[j]][name] instanceof Array) {
                                for (let i = 0; i < config[sections[j]][name].length; i++) {
                                    argv.push("--" + name)
                                    argv.push(config[sections[j]][name][i])
                                }
                            }
                        }
                    }
                }
            }
        }

        /*  determine virtual command-line arguments (step 3/3)  */
        while (k < process.argv.length)
            argv.push(process.argv[k++])

        /*  configure known standard options  */
        let options = [
            { names: [ "version", "v" ], type: "bool", "default": false,
              help: "Print application version and exit." },
            { names: [ "help", "h" ], type: "bool", "default": false,
              help: "Print this usage help and exit." },
            { name: "options", type: "string", "default": `${inifile}:default`,
              help: "Read options from file (INI format).", helpArg: "[FILE:]SECTION" }
        ]

        /*  allow other modules to modify options (usually by adding additional ones)  */
        kernel.hook("options:options", "none", options)

        /*  parse options  */
        let parser = dashdash.createParser({
            options: options,
            interspersed: false
        })
        let opts
        try {
            opts = parser.parse(argv)
        } catch (e) {
            console.error(sprintf("%s: ERROR: %s", kernel.rs("ctx:program"), e.message))
            process.exit(1)
        }

        /*  directly support --help and --version options  */
        if (opts.help) {
            let help = parser.help().trimRight()
            process.stdout.write(sprintf(
                "%s: USAGE: %s [options] [arguments]\noptions:\n%s",
                kernel.rs("ctx:program"), kernel.rs("ctx:program"), help
            ))
            process.exit(0)
        }
        else if (opts.version) {
            let Package = require(path.join(kernel.rs("ctx:basedir"), "package.json"))
            process.stdout.write(`${Package.name} ${Package.version} <${Package.homepage}>\n`)
            process.stdout.write(`${Package.description}\n`)
            process.stdout.write(`Copyright (c) ${Package.author.name} <${Package.author.url}>\n`)
            if (Package.license === "COM")
                process.stdout.write(`Distributed under commercial license\n`)
            else
                process.stdout.write(`Distributed under ${Package.license} license <http://spdx.org/licenses/${Package.license}.html>\n`)
            process.exit(0)
        }

        /*  export results  */
        kernel.rs("options:options", opts)
    }
}

