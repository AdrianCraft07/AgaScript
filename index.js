const _arguments = process.argv;
const fs = require('fs');
const cp = require('child_process');
const afs = require('@agacraft/fs');
const min = require('@agacraft/functions/min');
const global = require('./global.js');

let globalKeys = global.Objeto.claves(global).filter(v=>v!='global');

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
  [/define (.+?) como (.+?);/g, 'const $2 = $1;'],
  [/variable (.+?) como (.+?);/g, 'let $2 = $1;'],
  [/funcion (.+?)/g, 'function $1'],
  [/exporta defecto (.+?);/g, '__module_exports__ = $1;'],
  [/exporta (.+?) como (.+?);/g, '__module_exports__.$2 = $1;'],
  [/exportacion/g, '__module_exports__'],
  [/mientras (.+?)/g, 'while ($1)'],
  [/para \((.+?);(.+?);(.+?)\)/g, 'for ($1;$2;$3)'],
  [/para \((.+?) de (.+?)\)/g, 'for (let $1 of $2)'],
  [/para \((.+?) en (.+?)\)/g, 'for (let $1 in $2)'],
  [/si \((.+?)\)/g, 'if ($1)'],
  [/entonces/g, 'else'],
  [/verdadero/g, 'true'],
  [/falso/g, 'false'],
  [/Texto/g, 'String'],
  [/Numero/g, 'Number'],
  [/Booleano/g, 'Boolean'],
  [/Funcion/g, 'Function'],
  [/clase/g, 'class'],
  [/constructor/g, 'constructor'],
  [/super/g, 'super'],
  [/hereda (.+?);/g, 'extends $1'],
  [/retorna (.+?);/g, 'return $1;'],
  [/retorna;/g, 'return;'],
  [/estatico|estatica/g, 'static'],
  [/nuevo|nueva/g, 'new'],
  [/este|esta/g, 'this'],
];

const modules = {
  ESM: [
    ...syntax,
    [/importa (.+?) como (.+?);/g, 'import $2 from $1;']
  ],
  CJS: [
    ...syntax,
    [/importa (.+?) como (.+?);/g, 'const $2 = require($1);']
  ],
};

function compile(code, type) {
  let character = '\x00';
  return 'let __module_exports__ = {};\n'+modules[type].reduce((code, [regex, replace]) => {
    return code.replace(regex, replace);
  }, code.replaceAll('\r', '').replaceAll('\n', character)).replaceAll(character, '\n')+'\n'+(type == 'CJS' ? 'module.exports = __module_exports__;' : 'export default __module_exports__;');
}

function getProcess(module){
  return new global.Objeto({
    version,
    versions: new global.Objeto({
      node: process.versions.node,
    }),
    plataforma: process.platform,
    salir: () => process.exit(),
    env: new global.Objeto(process.env),
    argv: new global.Lista(...process.argv),
    mainModule: module,
  })
}

function getModule(filename, path){
  return  new global.Objeto({
    id: filename,
    path,
    exports: new global.Objeto(),
    filename,
    children: new global.Lista(),
  })
}

function execute(filePath) {
  const dir = getDirFromFilePath(filePath);
  const File = fs.readFileSync(filePath, 'utf8');
  const code = compile(File, 'CJS');

  const asRequire = mod => execute(mod.replace(/^\.\/(.+)$/, dir + '/$1'));
  const module = getModule(filePath, dir);

  const process = getProcess(module);

  new Function('module', 'exports', 'require', 'process', 'global', ...globalKeys, code)(
    module,
    module.exports,
    asRequire,
    process,
    global,
    ...globalKeys.map(key => global[key])
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
      if(!afs.isFile(file))
        if(afs.isFile(file+'.as'))
          file += '.as';
        else if(afs.isDirectory(file))
          file += '/index.as';
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
      if(!afs.isFile(file))
        if(afs.isFile(file+'.as'))
          file += '.as';
        else if(afs.isDirectory(file))
          file += '/index.as';
      getPath()
        .then(path => {
          const type =
            getValue('--type') ||
            getValue('-t') ||
            CONFIG.compilerOptions.module;
          const filePath = `${path}/${file}`;
          const File = `importa 'global' como global; define global como {${globalKeys}};`+fs.readFileSync(filePath, 'utf8');
          const code = compile(File, type);
          write(path, file, code);
        })
        .catch(console.error);
    },
  ],
];

let off = false

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
function exec(){
  for (const arg of argsApi) {
  if (arg[0].some(isArg)) {
    const argValid = arg[0].filter(isArg)[0];
    const value = getValue(argValid);
    arg[1](value);
    off = true;
    break;
  }
}
}
exec()

if(!off && _arguments[2]){
  _arguments[3] = _arguments[2]
  _arguments[2] = '-r'
  exec()
}else if(!off && CONFIG.compilerOptions.inpDir) {
  const callback = argsApi.filter(arg => arg[0][0] === '-c')[0][1];
  getTree(CONFIG.compilerOptions.inpDir, '.as').forEach(callback)
}