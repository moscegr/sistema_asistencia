package com.cbtis134.sistema.model;

public class PaseSalida {
    private String folio_pase;
    private Boolean es_grupal;
    private Boolean estatus_vigencia;
    private String fecha;
    private Object fecha_creacion;
    private String hora_salida;
    private String motivo;
    private Integer grado;
    private String grupo;
    private String especialidad;
    private String matricula;
    private String autorizado_por;

    public PaseSalida() {}

    public String getFolio_pase() { return folio_pase; }
    public void setFolio_pase(String folio_pase) { this.folio_pase = folio_pase; }
    public Boolean getEs_grupal() { return es_grupal; }
    public void setEs_grupal(Boolean es_grupal) { this.es_grupal = es_grupal; }
    public Boolean getEstatus_vigencia() { return estatus_vigencia; }
    public void setEstatus_vigencia(Boolean estatus_vigencia) { this.estatus_vigencia = estatus_vigencia; }
    public String getFecha() { return fecha; }
    public void setFecha(String fecha) { this.fecha = fecha; }
    public Object getFecha_creacion() { return fecha_creacion; }
    public void setFecha_creacion(Object fecha_creacion) { this.fecha_creacion = fecha_creacion; }
    public String getHora_salida() { return hora_salida; }
    public void setHora_salida(String hora_salida) { this.hora_salida = hora_salida; }
    public String getMotivo() { return motivo; }
    public void setMotivo(String motivo) { this.motivo = motivo; }
    public Integer getGrado() { return grado; }
    public void setGrado(Integer grado) { this.grado = grado; }
    public String getGrupo() { return grupo; }
    public void setGrupo(String grupo) { this.grupo = grupo; }
    public String getEspecialidad() { return especialidad; }
    public void setEspecialidad(String especialidad) { this.especialidad = especialidad; }
    public String getMatricula() { return matricula; }
    public void setMatricula(String matricula) { this.matricula = matricula; }
    public String getAutorizado_por() { return autorizado_por; }
    public void setAutorizado_por(String autorizado_por) { this.autorizado_por = autorizado_por; }
}