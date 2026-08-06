package com.cbtis134.sistema.model;

public class RegistroDiario {
    private String matricula;
    private String nombre;
    private String fecha;
    private String hora_entrada;
    private String hora_salida;
    private String estatus_actual;
    private String tipo_salida;
    private String grado;
    private String grupo;
    private String especialidad;

    public RegistroDiario() {}

    public String getMatricula() { return matricula; }
    public void setMatricula(String matricula) { this.matricula = matricula; }
    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }
    public String getFecha() { return fecha; }
    public void setFecha(String fecha) { this.fecha = fecha; }
    public String getHora_entrada() { return hora_entrada; }
    public void setHora_entrada(String hora_entrada) { this.hora_entrada = hora_entrada; }
    public String getHora_salida() { return hora_salida; }
    public void setHora_salida(String hora_salida) { this.hora_salida = hora_salida; }
    public String getEstatus_actual() { return estatus_actual; }
    public void setEstatus_actual(String estatus_actual) { this.estatus_actual = estatus_actual; }
    public String getTipo_salida() { return tipo_salida; }
    public void setTipo_salida(String tipo_salida) { this.tipo_salida = tipo_salida; }
    public String getGrado() { return grado; }
    public void setGrado(String grado) { this.grado = grado; }
    public String getGrupo() { return grupo; }
    public void setGrupo(String grupo) { this.grupo = grupo; }
    public String getEspecialidad() { return especialidad; }
    public void setEspecialidad(String especialidad) { this.especialidad = especialidad; }
}