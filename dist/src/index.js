let __module_exports__ = {};
const global = require('../../global');
const {pintar,Objeto,Lista} = global;

pintar(Objeto.crear(process))

pintar(process);

let i = 0;

class Persona{
  constructor(nombre, edad){
    this.nombre = nombre;
    this.edad = edad;
  }
  __aConsola__(){
    return "Nombre: " + this.nombre + ", edad: " + this.edad;
  }
}

class Estudiante extends Persona{
  constructor(nombre, edad, curso){
    super(nombre, edad)
    this.curso = curso;
  }
  static de(persona, curso){
    return new Estudiante(persona.nombre, persona.edad, curso);
  }
  __aConsola__(){
    return super.__aConsola__() + ", curso: " + this.curso;
  }
}

let juan = new Persona("Juan", 20);

pintar(juan);
pintar(Estudiante.de(juan, "1º ESO"));

pintar(global);
module.exports = __module_exports__;