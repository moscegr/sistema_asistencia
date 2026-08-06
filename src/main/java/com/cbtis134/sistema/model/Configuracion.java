package com.cbtis134.sistema.model;

import java.util.Map;

public class Configuracion {
    private Map<String, Object> ciclo_escolar;
    private Map<String, Object> escolar;
    private Map<String, Object> sistema;
    private Map<String, Object> whatsapp;

    public Configuracion() {}

    public Map<String, Object> getCiclo_escolar() { return ciclo_escolar; }
    public void setCiclo_escolar(Map<String, Object> ciclo_escolar) { this.ciclo_escolar = ciclo_escolar; }
    public Map<String, Object> getEscolar() { return escolar; }
    public void setEscolar(Map<String, Object> escolar) { this.escolar = escolar; }
    public Map<String, Object> getSistema() { return sistema; }
    public void setSistema(Map<String, Object> sistema) { this.sistema = sistema; }
    public Map<String, Object> getWhatsapp() { return whatsapp; }
    public void setWhatsapp(Map<String, Object> whatsapp) { this.whatsapp = whatsapp; }
}