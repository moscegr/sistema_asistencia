package com.cbtis134.sistema.model;

import java.util.List;
import java.util.Map;

public class IncidenciaPersonal {
    private String clave_reporte;
    private String interesado;
    private String jefe_personal;
    private String fecha;
    private String turno;
    private String elaborado_por;
    private List<Map<String, Object>> datos_modulos;

    public IncidenciaPersonal() {}

    public String getClave_reporte() { return clave_reporte; }
    public void setClave_reporte(String clave_reporte) { this.clave_reporte = clave_reporte; }
    public String getInteresado() { return interesado; }
    public void setInteresado(String interesado) { this.interesado = interesado; }
    public String getJefe_personal() { return jefe_personal; }
    public void setJefe_personal(String jefe_personal) { this.jefe_personal = jefe_personal; }
    public String getFecha() { return fecha; }
    public void setFecha(String fecha) { this.fecha = fecha; }
    public String getTurno() { return turno; }
    public void setTurno(String turno) { this.turno = turno; }
    public String getElaborado_por() { return elaborado_por; }
    public void setElaborado_por(String elaborado_por) { this.elaborado_por = elaborado_por; }
    public List<Map<String, Object>> getDatos_modulos() { return datos_modulos; }
    public void setDatos_modulos(List<Map<String, Object>> datos_modulos) { this.datos_modulos = datos_modulos; }
}