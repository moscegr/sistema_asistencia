package com.cbtis134.sistema.model;

public class Justificante {
    private String folio_justificante;
    private String id_alumno;
    private String inasistencia_dia;
    private String fecha_expedicion;
    private String motivo_detalle;
    private Integer grado;
    private String grupo;
    private String especialidad;
    private Object timestamp;

    public Justificante() {}

    public String getFolio_justificante() { return folio_justificante; }
    public void setFolio_justificante(String folio_justificante) { this.folio_justificante = folio_justificante; }
    public String getId_alumno() { return id_alumno; }
    public void setId_alumno(String id_alumno) { this.id_alumno = id_alumno; }
    public String getInasistencia_dia() { return inasistencia_dia; }
    public void setInasistencia_dia(String inasistencia_dia) { this.inasistencia_dia = inasistencia_dia; }
    public String getFecha_expedicion() { return fecha_expedicion; }
    public void setFecha_expedicion(String fecha_expedicion) { this.fecha_expedicion = fecha_expedicion; }
    public String getMotivo_detalle() { return motivo_detalle; }
    public void setMotivo_detalle(String motivo_detalle) { this.motivo_detalle = motivo_detalle; }
    public Integer getGrado() { return grado; }
    public void setGrado(Integer grado) { this.grado = grado; }
    public String getGrupo() { return grupo; }
    public void setGrupo(String grupo) { this.grupo = grupo; }
    public String getEspecialidad() { return especialidad; }
    public void setEspecialidad(String especialidad) { this.especialidad = especialidad; }
    public Object getTimestamp() { return timestamp; }
    public void setTimestamp(Object timestamp) { this.timestamp = timestamp; }
}