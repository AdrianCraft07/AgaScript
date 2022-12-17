const {colors, getClass} = require('@agacraft/functions');
const extension = require('@agacraft/extension');

const createAddFunctions = (...classes)=>{
  return (name, func)=>{
    for (const Class of classes) {
      extension.createAddFunction(Class)(name, func);
    }
  }
}

colors.vanilla = colors.magenta;

createAddFunctions(Number, Boolean)('__aConsola__', function () {
  return colors.yellow(this.toString());
});
extension.createAddFunction(Function)('__aConsola__', function () {
  let type = 'Funcion:';
  try {
    new this();
    type = 'clase'
  } catch (error) {
  }
  return colors.cyan(`[${type} ${this.name}]`);
});
extension.createAddFunction(String)('__aConsola__', function () {
  let string = this.toString();
  let quotes = "'";

  if (string.includes("'")) {
    if (string.includes('"')) {
      string = string.replace(/'/g, "\\'");
    } else {
      quotes = '"';
    }
  }

  return colors.green(quotes + string + quotes);
});

class unknown{
  __aConsola__(){
    return colors.cyan('[unknown]');
  }
}

class Objeto {
  constructor(o={}) {
    Objeto.definirPropiedades(this, Objeto.entradas(o));
  }
  static crear(o) {
    return new Objeto(o);
  }
  static definirPropiedades(o, props) {
    props.map(([k, v]) => Objeto.definirPropiedad(o, k, v));
    return o;
  }
  static definirPropiedad(o, k, v) {
    o[k] = v;
    return o;
  }
  static claves(o) {
    return Object.keys(o);
  }
  static entradas(o) {
    return Objeto.claves(o).map(k => [k, o[k]]);
  }
  static deEntradas(entradas) {
    return entradas.reduce((o, [k, v]) => Objeto.definirPropiedad(o, k, v), {});
  }
  toString() {
    return `[ objeto ${this.constructor.name} ]`;
  }
  aTexto() {
    return this.toString();
  }
  __aConsola__(i=1, r=1) {
    let getKey = k => {
      if (k.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
        return k;
      } else {
        if (k.__aConsola__) {
          return k.__aConsola__();
        } else {
          return k.toString();
        }
      }
    };
    let recursed = colors.cyan(`<ref *${r}> `)
    let isRecursed = false;
    let obj = Objeto.entradas(this).map(([k, v]) => {
      if(v==this){
        isRecursed = true;
        return ' '.repeat(i*2)+`${getKey(k)}: ${colors.cyan(`[Circular *${r}]`)}`;
      }
      if (v.__aConsola__) {
        return ' '.repeat(i*2)+`${getKey(k)}: ${v.__aConsola__(i+1, r+1)}`;
      } else {
        return ' '.repeat(i*2)+`${getKey(k)}: ${colors.vanilla(`[${getClass.getName(v)}]`)}`;
      }
    }).join(',\n')

    if(Objeto.claves(this).length==0) return '{}';

    return (isRecursed?recursed:'')+`{\n${obj}\n${' '.repeat((i*2)-2)}}`;
  }
}
class Lista extends Objeto {
  constructor(...args) {
    super();
    this.#push([...args]);
  }
  get longitud() {
    return [...this[Symbol.iterator]()].length;
  }
  set longitud(n) {
    let arr = [...this[Symbol.iterator]()];
    if (n < arr.length) {
      Objeto.claves(this).forEach(k => {
        delete this[k];
      })
      arr.length = n;
      this.#push(arr);
    }else{
      Objeto.claves(this).forEach(k => {
        delete this[k];
      })
      this.#push([...arr, ...Array(n-arr.length).fill(new unknown())]);
    }
  }
  #push(args) {
    args.forEach((v, i) => {
      this[i] = v;
    })
    return this;
  }
  static de(...args) {
    return new Lista(...args);
  }
  agregar(...args) {
    return [...this, ...args];
  }
  paraCada(fn) {
    Objeto.claves(this).forEach(k => {
      fn(this[k], k, this);
    })
  }
  map(fn) {
    return Lista.de(...Objeto.claves(this).map(k => this[k]).map(fn));
  }
  filtrar(fn) {
    return Lista.de(...Objeto.claves(this).map(k => this[k]).filter(fn))
  }
  unir(sep=', ') {
    return [...this.map(v => {
      if(!v)return v;
      if(v.aTexto)return v.aTexto();
      return v.toString()
    })[Symbol.iterator]()].join(sep);
  }
  [Symbol.iterator]() {
    return Objeto.claves(this).map(k => this[k])[Symbol.iterator]();
  }
  __aConsola__() {
    let unknowns = 0;
    const list = this.map((v, i) => {
      if(v instanceof unknown){
        unknowns++;
        if(this.longitud==(i+1)){
          return colors.gray(`<${unknowns} espacios vacios>`);
        }
        return;
      }
      else if(unknowns>0){
        unknowns = 0;
        return colors.gray(`<${unknowns} espacios vacios>`);
      }
      if(this.longitud==(i+1) && i>20)return `...${this.longitud-i} mas`
      if(v === null)return colors.whiteBright('nulo');
      if(v === undefined)return colors.gray('indefinido');
      if (v.__aConsola__) {
        return v.__aConsola__();
      } else {
        return colors.vanilla(`[${getClass.getName(v)}]`);
      }
    }).filtrar(Boolean);
    if(list.longitud==0)list[0] = colors.gray('Lista vacía')
    return `[ ${list.unir(', ')} ]`;
  }
}

function pintar(...args) {
  const list = [...args].map(v => {
    if(v === null)return colors.whiteBright('nulo');
    if(v === undefined)return colors.gray('indefinido');
    if (v.__aConsola__) {
      return v.__aConsola__();
    } else {
      return colors.vanilla(`[${getClass.getName(v)}]`);
    }
  });
  process.stdout.write(list.join(' ') + '\n');
}
pintar.nativo = console.log

let global = Objeto.crear({
  pintar,
  Objeto,
  Lista,
});
global['global'] = global;

module.exports = global;