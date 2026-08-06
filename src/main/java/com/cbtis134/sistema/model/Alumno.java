package com.cbtis134.sistema.model;

import java.util.List;
import java.util.Map;

public class Alumno {
    private String matricula;
    private String curp;
    private String nombre;
    private String apepat;
    private String apemat;
    private String genero;
    private String email;
    private String celular;
    private String direccion;
    private String especialidad;
    private String grado;
    private String grupo;
    private String turno;
    private String estatus_escolar;
    private String color_semaforo;
    private Boolean perfil_completo;
    private String nombretutor;
    private String teltutor;
    private String ocupaciontutor;
    private String qr_texto;
    private String registradoPor;
    private List<Double> descriptor_facial;
    private String estado;
    private String fecha_ultima_asistencia;
    private Object fecharegistro;
    private String aula_especifica;
    private String motivo_baja;
    private Double promedio;
    private String escuela_procedencia;
    private String nss;
    private String qr_url;
    private List<Map<String, Object>> padecimientos_registrados;

    public Alumno() {}

    // Getters y Setters
    public String getMatricula() { return matricula; }
    public void setMatricula(String matricula) { this.matricula = matricula; }
    public String getCurp() { return curp; }
    public void setCurp(String curp) { this.curp = curp; }
    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }
    public String getApepat() { return apepat; }
    public void setApepat(String apepat) { this.apepat = apepat; }
    public String getApemat() { return apemat; }
    public void setApemat(String apemat) { this.apemat = apemat; }
    public String getGenero() { return genero; }
    public void setGenero(String genero) { this.genero = genero; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getCelular() { return celular; }
    public void setCelular(String celular) { this.celular = celular; }
    public String getDireccion() { return direccion; }
    public void setDireccion(String direccion) { this.direccion = direccion; }
    public String getEspecialidad() { return especialidad; }
    public void setEspecialidad(String especialidad) { this.especialidad = especialidad; }
    public String getGrado() { return grado; }
    public void setGrado(String grado) { this.grado = grado; }
    public String getGrupo() { return grupo; }
    public void setGrupo(String grupo) { this.grupo = grupo; }
    public String getTurno() { return turno; }
    public void setTurno(String turno) { this.turno = turno; }
    public String getEstatus_escolar() { return estatus_escolar; }
    public void setEstatus_escolar(String estatus_escolar) { this.estatus_escolar = estatus_escolar; }
    public String getColor_semaforo() { return color_semaforo; }
    public void setColor_semaforo(String color_semaforo) { this.color_semaforo = color_semaforo; }
    public Boolean getPerfil_completo() { return perfil_completo; }
    public void setPerfil_completo(Boolean perfil_completo) { this.perfil_completo = perfil_completo; }
    public String getNombretutor() { return nombretutor; }
    public void setNombretutor(String nombretutor) { this.nombretutor = nombretutor; }
    public String getTeltutor() { return teltutor; }
    public void setTeltutor(String teltutor) { this.teltutor = teltutor; }
    public String getOcupaciontutor() { return ocupaciontutor; }
    public void setOcupaciontutor(String ocupaciontutor) { this.ocupaciontutor = ocupaciontutor; }
    public String getQr_texto() { return qr_texto; }
    public void setQr_texto(String qr_texto) { this.qr_texto = qr_texto; }
    public String getRegistradoPor() { return registradoPor; }
    public void setRegistradoPor(String registradoPor) { this.registradoPor = registradoPor; }
    public List<Double> getDescriptor_facial() { return descriptor_facial; }
    public void setDescriptor_facial(List<Double> descriptor_facial) { this.descriptor_facial = descriptor_facial; }
    public String getEstado() { return estado; }
    public void setEstado(String estado) { this.estado = estado; }
    public String getFecha_ultima_asistencia() { return fecha_ultima_asistencia; }
    public void setFecha_ultima_asistencia(String fecha_ultima_asistencia) { this.fecha_ultima_asistencia = fecha_ultima_asistencia; }
    public Object getFecharegistro() { return fecharegistro; }
    public void setFecharegistro(Object fecharegistro) { this.fecharegistro = fecharegistro; }
    public String getAula_especifica() { return aula_especifica; }
    public void setAula_especifica(String aula_especifica) { this.aula_especifica = aula_especifica; }
    public String getMotivo_baja() { return motivo_baja; }
    public void setMotivo_baja(String motivo_baja) { this.motivo_baja = motivo_baja; }
    public Double getPromedio() { return promedio; }
    public void setPromedio(Double promedio) { this.promedio = promedio; }
    public String getEscuela_procedencia() { return escuela_procedencia; }
    public void setEscuela_procedencia(String escuela_procedencia) { this.escuela_procedencia = escuela_procedencia; }
    public String getNss() { return nss; }
    public void setNss(String nss) { this.nss = nss; }
    public String getQr_url() { return qr_url; }
    public void setQr_url(String qr_url) { this.qr_url = qr_url; }
    public List<Map<String, Object>> getPadecimientos_registrados() { return padecimientos_registrados; }
    public void setPadecimientos_registrados(List<Map<String, Object>> padecimientos_registrados) { this.padecimientos_registrados = padecimientos_registrados; }
}