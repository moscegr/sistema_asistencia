package com.cbtis134.sistema.model;

public class EventoCalendario {
    private String title;
    private String start;
    private String end;
    private Boolean allDay;
    private String color;
    private String creadoPor;
    private Object fechaRegistro;

    public EventoCalendario() {}

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
    public String getCreadoPor() { return creadoPor; }
    public void setCreadoPor(String creadoPor) { this.creadoPor = creadoPor; }
    public Object getFechaRegistro() { return fechaRegistro; }
    public void setFechaRegistro(Object fechaRegistro) { this.fechaRegistro = fechaRegistro; }
}