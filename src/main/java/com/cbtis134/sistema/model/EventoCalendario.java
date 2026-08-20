package com.cbtis134.sistema.model;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "calendario")
public class EventoCalendario {
    @Id
    @JsonProperty("id")
    @JsonAlias({"_id", "id"})
    private String id;

    private String title;
    private String start;
    private String end;
    private Boolean allDay;
    private String color;
    private String descripcion;
    private String creadoPor;
    private Object fechaRegistro;

    public EventoCalendario() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getStart() { return start; }
    public void setStart(String start) { this.start = start; }

    public String getEnd() { return end; }
    public void setEnd(String end) { this.end = end; }

    public Boolean getAllDay() { return allDay; }
    public void setAllDay(Boolean allDay) { this.allDay = allDay; }

    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }

    public String getDescripcion() { return descripcion; }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }

    public String getCreadoPor() { return creadoPor; }
    public void setCreadoPor(String creadoPor) { this.creadoPor = creadoPor; }

    public Object getFechaRegistro() { return fechaRegistro; }
    public void setFechaRegistro(Object fechaRegistro) { this.fechaRegistro = fechaRegistro; }
}