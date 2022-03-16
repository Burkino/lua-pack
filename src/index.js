const Bundle = require('./classes/Bundle');
const Script = require('./classes/Script');

const util = require('../util');
const path = require('path');
const fs   = require('fs');

class LuaPack {
    constructor(directory) {
        this.directory = directory;

        this.config = JSON.parse(fs.readFileSync(path.join(directory, 'luapack.config.json')));
        this.config.directory = directory;

        this.inputCharacters = 0;
        this.outputCharacters = 0;
    }

    get compressionLevel() {
        return util.calcCompression(this.inputCharacters, this.outputCharacters);
    }

    async loadScripts() {
        const scripts = [];

        function scanDirectory(directory, config, start) {
            for (let file of fs.readdirSync(directory)) {
                const stats = fs.statSync(path.join(directory, file));

                if (stats.isFile() && file.endsWith('.lua')) {
                    const isEntry = directory == start && file == config.entry;

                    scripts.push(new Script(path.join(directory, file), config, isEntry));
                } else if (stats.isDirectory() && !(file == 'build' && directory == start)) {
                    scanDirectory(path.join(directory, file), config, start);
                }
            }
        }
        scanDirectory(this.directory, this.config, this.directory);

        return scripts;
    }

    async pack() {
        const bundle = new Bundle(this.config);

        bundle.setEntry(path.join(this.config.directory, this.config.entry));
        for (let script of await this.loadScripts()) {
            if (!script.isEntry) {
                const { name, source } = await script.init();

                if (name && source)
                    bundle.addModule(name, source);
            }
            
            this.inputCharacters += script.source.length;
        }
        
        const out = await bundle.assemble();
        this.outputCharacters = out.length;
    
        return out;
    }
}

module.exports = LuaPack;