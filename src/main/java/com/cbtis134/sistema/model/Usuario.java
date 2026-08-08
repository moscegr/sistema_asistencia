package com.cbtis134.sistema.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.List;

@Document(collection = "usuarios")
public class Usuario {

    @Id
    private String id;
    private String uid;
    private String correo;
    private String password;
    private String nombre;
    private String rol;
    private String estatus;
    private Object fecha_registro;
    private Object ultimo_acceso;
    private List<String> permisos;

    public Usuario() {
    }

    public Usuario(String id, String uid, String correo, String password, String nombre, String rol, String estatus, Object fecha_registro, Object ultimo_acceso, List<String> permisos) {
        this.id = id;
        this.uid = uid;
        this.correo = correo;
        this.password = password;
        this.nombre = nombre;
        this.rol = rol;
        this.estatus = estatus;
        this.fecha_registro = fecha_registro;
        this.ultimo_acceso = ultimo_acceso;
        this.permisos = permisos;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getUid() {
        return uid;
    }

    public void setUid(String uid) {
        this.uid = uid;
    }

    public String getCorreo() {
        return correo;
    }

    public void setCorreo(String correo) {
        this.correo = correo;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getNombre() {
        return nombre;
    }

    public void setNombre(String nombre) {
        this.nombre = nombre;
    }

    public String getRol() {
        return rol;
    }

    public void setRol(String rol) {
        this.rol = rol;
    }

    public String getEstatus() {
        return estatus;
    }

    public void setEstatus(String estatus) {
        this.estatus = estatus;
    }

    public Object getFecha_registro() {
        return fecha_registro;
    }

    public void setFecha_registro(Object fecha_registro) {
        this.fecha_registro = fecha_registro;
    }

    public Object getUltimo_acceso() {
        return ultimo_acceso;
    }

    public void setUltimo_acceso(Object ultimo_acceso) {
        this.ultimo_acceso = ultimo_acceso;
    }

    public String getUltimoAcceso() {
        return ultimo_acceso != null ? ultimo_acceso.toString() : null;
    }

    public void setUltimoAcceso(String ultimoAcceso) {
        this.ultimo_acceso = ultimoAcceso;
    }

    public List<String> getPermisos() {
        return permisos;
    }

    public void setPermisos(List<String> permisos) {
        this.permisos = permisos;
    }
}