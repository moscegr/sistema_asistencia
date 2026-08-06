package com.cbtis134.sistema.model;

import java.util.List;

public class Usuario {
    private String uid;
    private String nombre;
    private String correo;
    private String rol;
    private String estatus;
    private Object fecha_registro;
    private List<String> permisos;
    private Object ultimo_acceso;

    public Usuario() {}

    public String getUid() { return uid; }
    public void setUid(String uid) { this.uid = uid; }
    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }
    public String getCorreo() { return correo; }
    public void setCorreo(String correo) { this.correo = correo; }
    public String getRol() { return rol; }
    public void setRol(String rol) { this.rol = rol; }
    public String getEstatus() { return estatus; }
    public void setEstatus(String estatus) { this.estatus = estatus; }
    public Object getFecha_registro() { return fecha_registro; }
    public void setFecha_registro(Object fecha_registro) { this.fecha_registro = fecha_registro; }
    public List<String> getPermisos() { return permisos; }
    public void setPermisos(List<String> permisos) { this.permisos = permisos; }
    public Object getUltimo_acceso() { return ultimo_acceso; }
    public void setUltimo_acceso(Object ultimo_acceso) { this.ultimo_acceso = ultimo_acceso; }
}