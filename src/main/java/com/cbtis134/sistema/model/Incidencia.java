package com.cbtis134.sistema.model;

import java.util.List;

public class Incidencia {
    private String folio_incidencia;
    private String id_alumno;
    private String ciclo;
    private Integer grado;
    private String grupo;
    private String especialidad;
    private List<String> faltas_checklist;
    private String descripcion_detallada;
    private Object fecha_registro;

    public Incidencia() {}

    public String getFolio_incidencia() { return folio_incidencia; }
    public void setFolio_incidencia(String folio_incidencia) { this.folio_incidencia = folio_incidencia; }
    public String getId_alumno() { return id_alumno; }
    public void setId_alumno(String id_alumno) { this.id_alumno = id_alumno; }
    public String getCiclo() { return ciclo; }
    public void setCiclo(String ciclo) { this.ciclo = ciclo; }
    public Integer getGrado() { return grado; }
    public void setGrado(Integer grado) { this.grado = grado; }
    public String getGrupo() { return grupo; }
    public void setGrupo(String grupo) { this.grupo = grupo; }
    public String getEspecialidad() { return especialidad; }
    public void setEspecialidad(String especialidad) { this.especialidad = especialidad; }
    public List<String> getFaltas_checklist() { return faltas_checklist; }
    public void setFaltas_checklist(List<String> faltas_checklist) { this.faltas_checklist = faltas_checklist; }
    public String getDescripcion_detallada() { return descripcion_detallada; }
    public void setDescripcion_detallada(String descripcion_detallada) { this.descripcion_detallada = descripcion_detallada; }
    public Object getFecha_registro() { return fecha_registro; }
    public void setFecha_registro(Object fecha_registro) { this.fecha_registro = fecha_registro; }
}