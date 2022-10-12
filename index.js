const _arguments = process.argv;
const fs = require('fs');
const cp = require('child_process');
const afs = require('@agacraft/fs');
const min = require('@agacraft/functions/min');

function toJson(code) {
  return new Function('return ' + code)();
}

const DEFAULT_CONFIG = `{
  "compilerOptions": {
    "module": "ESM",     /* module type ESM (ECMA Script Module) or CJS (Common JS)*/
    // "outDir": "./",   /* output directory */
    // "inpDir": "./",   /* input directory */
    "minify": false,     /* minify code */
    "": null
  }
}`;

let CONFIG = toJson(DEFAULT_CONFIG);

if (afs.isFile('asconfig.json')) {
  const config = fs.readFileSync('./asconfig.json');
  const compilerOptions = toJson(config).compilerOptions;
  compilerOptions.module ||= CONFIG.compilerOptions.module;
  compilerOptions.minify ||= CONFIG.compilerOptions.minify;
  compilerOptions.outDir ||= CONFIG.compilerOptions.outDir;
  compilerOptions.inpDir ||= CONFIG.compilerOptions.inpDir;
  CONFIG.compilerOptions = compilerOptions;
}

const package = require('./package.json');
const version = package.version;

function isArg(arg) {
  return _arguments.includes(arg);
}
function getValue(arg) {
  if (_arguments.indexOf(arg) === -1) return null;
  return _arguments[_arguments.indexOf(arg) + 1];
}

function getPath() {
  return new Promise((resolve, reject) => {
    cp.exec('cd', (err, stdout, stderr) => {
      if (err) reject(err);
      resolve(stdout.trim());
    });
  });
}

function getDirFromFilePath(filePath) {
  return filePath.split(/[/\\]/g).slice(0, -1).join('/');
}

const syntax = [
  [/define (.+?) como (.+?);/g, 'let $2 = $1;'],
  [/funcion (.+?)/g, 'function $1'],
  [/pintar\((.+?)\);/g, 'console.log($1);'],
];

const modules = {
  ESM: [
    ...syntax,
    [/importa (.+?) como (.+?);/g, 'import $2 from $1;'],
    [/exporta defecto (.+?);/g, 'export default $1;'],
    [/exporta (.+?) como (.+?);/g, 'export let $2 = $1;'],
  ],
  CJS: [
    ...syntax,
    [/importa (.+?) como (.+?);/g, 'const $2 = require($1);'],
    [/exporta defecto (.+?);/g, 'module.exports = $1;'],
    [/exporta (.+?) como (.+?);/g, 'exports.$2 = $1;'],
  ],
};

function compile(code, type) {
  return modules[type].reduce((code, [regex, replace]) => {
    return code.replace(regex, replace);
  }, code);
}

function execute(filePath) {
  const dir = getDirFromFilePath(filePath);
  const File = fs.readFileSync(filePath, 'utf8');
  const code = compile(File, 'CJS');

  const asRequire = mod => execute(mod.replace(/^\.\/(.+)$/, dir + '/$1'));
  const module = { exports: {} };

  new Function('module', 'exports', 'require', code)(
    module,
    module.exports,
    asRequire
  );
  return module.exports;
}

function write(path, file, code) {
  file = file.replace(/.as$/, '.js');

  if (CONFIG.compilerOptions.minify) {
    code = min(code);
    file = file.replace(/\.js$/, '.min.js');
  }

  let filePath = path + '/' + file;
  if (CONFIG.compilerOptions.inpDir)
    file = file.replace(CONFIG.compilerOptions.inpDir, '');
  if (CONFIG.compilerOptions.outDir)
    filePath = CONFIG.compilerOptions.outDir + '/' + file;

  afs.file(filePath, code);
}

const argsApi = [
  [['-h', '--help'], _ => {}],
  [
    ['-i', '--init'],
    _ => {
      afs.file('./asconfig.json', DEFAULT_CONFIG);
    },
  ],
  [
    ['-v', '--version'],
    _ => {
      console.log(`v${version}`);
    },
  ],
  [
    ['-r', '--run'],
    file => {
      getPath()
        .then(path => {
          const filePath = `${path}/${file}`;
          execute(filePath);
        })
        .catch(console.error);
    },
  ],
  [
    ['-c', '--compile'],
    file => {
      getPath()
        .then(path => {
          const type =
            getValue('--type') ||
            getValue('-t') ||
            CONFIG.compilerOptions.module;
          const filePath = `${path}/${file}`;
          const File = fs.readFileSync(filePath, 'utf8');
          const code = compile(File, type);
          write(path, file, code);
        })
        .catch(console.error);
    },
  ],
];

let off = false

for (const arg of argsApi) {
  if (arg[0].some(isArg)) {
    const argValid = arg[0].filter(isArg)[0];
    const value = getValue(argValid);
    arg[1](value);
    off = true;
    break;
  }
}

function getTree(path, ext) {
  let tree = [];
  const files = fs.readdirSync(path);
  for (const file of files) {
    const filePath = `${path}/${file}`;
    if (fs.statSync(filePath).isDirectory()) {
      tree = [...tree, ...getTree(filePath, ext)];
    } else if (file.endsWith(ext)) {
      tree.push(filePath);
    }
  }
  return tree;
}

if(!off && CONFIG.compilerOptions.inpDir) {
  const callback = argsApi.filter(arg => arg[0][0] === '-c')[0][1];
  getTree(CONFIG.compilerOptions.inpDir, '.as').forEach(callback)
} else if(!off) {
  console.log('No se ha especificado una acción');
} else {
  console.log('AgaScript ha terminado');
}
