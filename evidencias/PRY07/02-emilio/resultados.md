# PRY07 · Resultados de integridad y seguridad (Emilio)

Generado: 2026-11-26T03:06:15.378594+00:00

| Métrica | Cantidad |
| --- | --- |
| Casos registrados | 114 |
| PASS | 111 |
| FAIL | 0 |
| BLOCKED | 3 |
| NOT RUN | 0 |

| ID | Módulo | Acción y resultado esperado | Resultado observado | Estado | Evidencia | Ajuste |
| --- | --- | --- | --- | --- | --- | --- |
| CON-01 | Concurrencia real | Dos reservas simultáneas del mismo horario: una gana y una es rechazada | exitos=1 rechazos_23P01=1 filas=1 | PASS | resultados.json#CON-01 |  |
| CON-02 | Concurrencia real | Dos confirmaciones simultáneas son idempotentes y auditan una sola vez | exitos=2 conflictos_PT409=0 eventos=1 estado=confirmed | PASS | resultados.json#CON-02 | Migración 202611250001: la confirmación idempotente se resuelve antes de comparar la versión; no se escribe la fila. |
| CON-03 | Concurrencia real | Bloqueo y reserva simultáneos no pueden coexistir en el mismo horario | exitos=1 rechazos=1 objetos=1 | PASS | resultados.json#CON-03 |  |
| CON-04 | Concurrencia real | Dos cancelaciones simultáneas no duplican auditoría ni el motivo | exitos=2 eventos=1 estado=cancelled/Motivo concurrente A | PASS | resultados.json#CON-04 |  |
| CON-05 | Concurrencia real | Dos reprogramaciones simultáneas al mismo horario: solo una ocupa el espacio | exitos=1 rechazos=1 filas=1 | PASS | resultados.json#CON-05 |  |
| CON-06 | Concurrencia real | Dos reservas simultáneas no superpuestas se aceptan sin bloquear de más | exitos=2 filas=2 | PASS | resultados.json#CON-06 |  |
| EXP-01 | Expedientes clínicos | Lectura de expediente por un usuario no vinculado | BLOQUEADO POR INTEGRACIÓN: el PR #11 con el esquema clínico sigue abierto y no está incluido en feature/pry07-base-e2e. | BLOCKED | resultados.json#EXP-01 |  |
| EXP-02 | Expedientes clínicos | Autoría y protección de revisiones clínicas | BLOQUEADO POR INTEGRACIÓN: no existen tablas de expediente ni de revisiones clínicas en esta rama. | BLOCKED | resultados.json#EXP-02 |  |
| EXP-03 | Expedientes clínicos | Escritura directa sobre expediente y revisiones | BLOQUEADO POR INTEGRACIÓN: depende del esquema clínico del PR #11. | BLOCKED | resultados.json#EXP-03 |  |
| INT-01 | Integridad referencial | Rechaza una cita con paciente inexistente (FK) | esperado=23503 obtenido=23503 mensaje=insert or update on table "appointments" violates foreign key constraint "appointments_patient_id_fkey" | PASS | resultados.json#INT-01 |  |
| INT-02 | Integridad referencial | Rechaza una cita con médico inexistente (FK) | esperado=23503 obtenido=23503 mensaje=insert or update on table "appointments" violates foreign key constraint "appointments_physician_id_fkey" | PASS | resultados.json#INT-02 |  |
| INT-03 | Integridad referencial | Rechaza un estado de cita fuera del contrato | esperado=23514 obtenido=23514 mensaje=new row for relation "appointments" violates check constraint "appointments_status_check" | PASS | resultados.json#INT-03 |  |
| INT-04 | Integridad referencial | Rechaza una duración distinta de 15, 30, 45 o 60 | esperado=23514 obtenido=23514 mensaje=new row for relation "appointments" violates check constraint "appointments_duration_check" | PASS | resultados.json#INT-04 |  |
| INT-05 | Integridad referencial | Rechaza un paciente con clave primaria duplicada | esperado=23505 obtenido=23505 mensaje=duplicate key value violates unique constraint "patients_pkey" | PASS | resultados.json#INT-05 |  |
| INT-06 | Integridad referencial | Impide borrar un paciente con citas asociadas (FK restrict) | esperado=23503 obtenido=23503 mensaje=update or delete on table "patients" violates foreign key constraint "appointments_patient_id_fkey" on table "appointments" | PASS | resultados.json#INT-06 |  |
| INT-07 | Integridad referencial | Impide borrar un médico con citas asociadas (FK restrict) | esperado=23503 obtenido=23503 mensaje=update or delete on table "physicians" violates foreign key constraint "appointments_physician_id_fkey" on table "appointments" | PASS | resultados.json#INT-07 |  |
| INT-08 | Integridad referencial | Alta válida calcula ends_at, inicia pending y registra el evento created | comprobado estado, ends_at y auditoría | PASS | resultados.json#INT-08 |  |
| INT-09 | Integridad referencial | Rechaza un motivo de consulta vacío | esperado=23514 obtenido=23514 mensaje=new row for relation "appointments" violates check constraint "appointments_reason_check" | PASS | resultados.json#INT-09 |  |
| INT-10 | Integridad referencial | Una inserción rechazada no modifica citas ni auditoría | citas=1->1 eventos=1->1 | PASS | resultados.json#INT-10 |  |
| INT-11 | Integridad referencial | El trigger recalcula ends_at aunque el cliente envíe otro valor | ends_at recalculado desde starts_at y duration_minutes | PASS | resultados.json#INT-11 |  |
| INT-12 | Integridad referencial | Rechaza un evento de historial con cita inexistente | esperado=23503 obtenido=23503 mensaje=insert or update on table "appointment_events" violates foreign key constraint "appointment_events_appointment_id_fkey" | PASS | resultados.json#INT-12 |  |
| INT-13 | Integridad referencial | Rechaza mover una cita a un paciente inexistente | esperado=23503 obtenido=23503 mensaje=insert or update on table "appointments" violates foreign key constraint "appointments_patient_id_fkey" | PASS | resultados.json#INT-13 |  |
| INT-14 | Integridad referencial | Rechaza mover una cita a un médico inexistente | esperado=23503 obtenido=23503 mensaje=insert or update on table "appointments" violates foreign key constraint "appointments_physician_id_fkey" | PASS | resultados.json#INT-14 |  |
| INT-15 | Integridad referencial | Rechaza actualizar una cita a un estado inválido | esperado=23514 obtenido=23514 mensaje=new row for relation "appointments" violates check constraint "appointments_status_check" | PASS | resultados.json#INT-15 |  |
| INT-16 | Integridad referencial | La cita conserva la relación con su paciente y su médico | join paciente/médico comprobado | PASS | resultados.json#INT-16 |  |
| INT-17 | Integridad referencial | Rechaza un bloqueo de agenda con fin anterior al inicio | esperado=23514 obtenido=23514 mensaje=new row for relation "physician_schedule_blocks" violates check constraint "physician_schedule_blocks_interval_check" | PASS | resultados.json#INT-17 |  |
| INT-18 | Integridad referencial | Rechaza un bloqueo de agenda con médico inexistente | esperado=23503 obtenido=23503 mensaje=insert or update on table "physician_schedule_blocks" violates foreign key constraint "physician_schedule_blocks_physician_id_fkey" | PASS | resultados.json#INT-18 |  |
| INT-19 | Integridad referencial | Impide borrar una cita que tiene historial (FK restrict) | esperado=23503 obtenido=23503 mensaje=update or delete on table "appointments" violates foreign key constraint "appointment_events_appointment_id_fkey" on table "appointment_events" | PASS | resultados.json#INT-19 |  |
| INT-20 | Integridad referencial | Impide borrar un médico con bloqueos de agenda (FK restrict) | esperado=23503 obtenido=23503 mensaje=update or delete on table "physicians" violates foreign key constraint "physician_schedule_blocks_physician_id_fkey" on table "physician_schedule_blocks" | PASS | resultados.json#INT-20 |  |
| PER-01 | Persistencia entre conexiones | La creación confirmada por recepción se lee desde otra conexión | COMMIT recibido | PASS | resultados.json#PER-01 |  |
| PER-02 | Persistencia entre conexiones | La cita persistida conserva estado, fin derivado y evento created | observado=pending/true/1 | PASS | resultados.json#PER-02 |  |
| PER-03 | Persistencia entre conexiones | La reserva duplicada se rechaza entre conexiones | ERROR:  23P01: conflicting key value violates exclusion constraint "appointments_no_overlap" DETAIL:  Key conflicts with existing key. SCHEMA NAME:  public TABLE NAME:  appointments CONSTRAINT NAME:  appointments_no_overlap LOCATION:  check_exclusion_or_unique_constraint, execIndexing.c:905  | PASS | resultados.json#PER-03 |  |
| PER-04 | Persistencia entre conexiones | El rechazo no deja una fila duplicada | filas=1 | PASS | resultados.json#PER-04 |  |
| PER-05 | Persistencia entre conexiones | La cancelación por RPC se confirma y persiste | COMMIT recibido | PASS | resultados.json#PER-05 |  |
| PER-06 | Persistencia entre conexiones | La cancelación persiste con motivo, autor y un solo evento | observado=cancelled/Motivo persistente/true/1 | PASS | resultados.json#PER-06 |  |
| PER-07 | Persistencia entre conexiones | El horario liberado acepta una reserva persistente y mantiene el historial | filas_activas=2/1 | PASS | resultados.json#PER-07 |  |
| CIT-01 | Reglas de citas | El personal autorizado crea una cita pending con fin derivado | cita y evento created comprobados | PASS | resultados.json#CIT-01 |  |
| CIT-02 | Reglas de citas | Rechaza dos citas superpuestas para el mismo médico | esperado=23P01 obtenido=23P01 mensaje=conflicting key value violates exclusion constraint "appointments_no_overlap" | PASS | resultados.json#CIT-02 |  |
| CIT-03 | Reglas de citas | Rechaza reprogramar una cita sobre un horario ocupado | esperado=23P01 obtenido=23P01 mensaje=conflicting key value violates exclusion constraint "appointments_no_overlap" | PASS | resultados.json#CIT-03 |  |
| CIT-04 | Reglas de citas | Permite el mismo horario para médicos distintos | dos médicos con cita a la misma hora | PASS | resultados.json#CIT-04 |  |
| CIT-05 | Reglas de citas | Reprogramar guarda inicio, duración, fin y evento rescheduled | cita reprogramada y auditada | PASS | resultados.json#CIT-05 |  |
| CIT-06 | Reglas de citas | Cancelar conserva la fila, el motivo y el autor | estado, motivo y actor comprobados | PASS | resultados.json#CIT-06 |  |
| CIT-07 | Reglas de citas | La cancelación conserva la cita y registra un único evento cancelled | fila y auditoría conservadas | PASS | resultados.json#CIT-07 |  |
| CIT-08 | Reglas de citas | El horario liberado por cancelación acepta una nueva reserva | reserva nueva aceptada | PASS | resultados.json#CIT-08 |  |
| CIT-09 | Reglas de citas | Confirmar guarda estado, fecha y autor, con un evento confirmed | confirmación y auditoría comprobadas | PASS | resultados.json#CIT-09 |  |
| CIT-10 | Reglas de citas | Repetir la confirmación con la versión vigente no duplica la auditoría | un solo evento confirmed | PASS | resultados.json#CIT-10 |  |
| CIT-11 | Reglas de citas | Reprogramar una confirmada la devuelve a pending y retira la confirmación | estado y campos de confirmación comprobados | PASS | resultados.json#CIT-11 |  |
| CIT-12 | Reglas de citas | Rechaza una mutación con updated_at desactualizado | esperado=PT409 obtenido=PT409 mensaje=La cita cambió mientras se editaba. | PASS | resultados.json#CIT-12 |  |
| CIT-13 | Reglas de citas | Rechaza confirmar una cita cancelada | esperado=PT422 obtenido=PT422 mensaje=No se puede confirmar una cita cancelada. | PASS | resultados.json#CIT-13 |  |
| CIT-14 | Reglas de citas | Rechaza reprogramar una cita cancelada | esperado=PT422 obtenido=PT422 mensaje=No se puede reprogramar una cita cancelada. | PASS | resultados.json#CIT-14 |  |
| CIT-15 | Reglas de citas | Rechaza una cancelación sin motivo y conserva la cita | esperado=PT400 obtenido=PT400 mensaje=Indica un motivo de cancelación válido. | PASS | resultados.json#CIT-15 |  |
| CIT-15b | Reglas de citas | La cancelación rechazada no cambia el estado de la cita | estado pending conservado | PASS | resultados.json#CIT-15b |  |
| CIT-16 | Reglas de citas | Rechaza operar sobre una cita inexistente | esperado=PT404 obtenido=PT404 mensaje=La cita no existe. | PASS | resultados.json#CIT-16 |  |
| CIT-17 | Reglas de citas | El traslape rechazado no crea filas ni auditoría adicional | sin cita en el horario rechazado | PASS | resultados.json#CIT-17 |  |
| CIT-18 | Reglas de citas | Repetir la cancelación conserva el motivo y no duplica auditoría | motivo original y un solo evento | PASS | resultados.json#CIT-18 |  |
| CIT-19 | Reglas de citas | Rechaza reprogramar una cita al pasado | esperado=PT400 obtenido=PT400 mensaje=La cita no puede quedar en el pasado. | PASS | resultados.json#CIT-19 |  |
| CIT-20 | Reglas de citas | Rechaza una duración inválida en reprogramación | esperado=PT400 obtenido=PT400 mensaje=Los datos de la reprogramación no son válidos. | PASS | resultados.json#CIT-20 |  |
| CIT-21 | Reglas de citas | La cita cancelada conserva sus eventos anteriores | eventos created y cancelled presentes | PASS | resultados.json#CIT-21 |  |
| SEC-01 | Seguridad y RLS | Las cinco tablas del módulo tienen RLS activo | patients, physicians, appointments, appointment_events y physician_schedule_blocks | PASS | resultados.json#SEC-01 |  |
| SEC-02 | Seguridad y RLS | authenticated puede leer e insertar citas pero no actualizar ni borrar | SELECT/INSERT sí; UPDATE/DELETE no | PASS | resultados.json#SEC-02 |  |
| SEC-03 | Seguridad y RLS | El historial de citas solo permite SELECT a authenticated | sin escritura directa sobre append-only | PASS | resultados.json#SEC-03 |  |
| SEC-04 | Seguridad y RLS | anon no tiene privilegios sobre ninguna tabla del módulo | sin SELECT en las cinco tablas | PASS | resultados.json#SEC-04 |  |
| SEC-05 | Seguridad y RLS | Las RPC solo son ejecutables por authenticated | anon sin EXECUTE; authenticated con EXECUTE | PASS | resultados.json#SEC-05 |  |
| SEC-06 | Seguridad y RLS | La función de trigger de bloqueos no es ejecutable por authenticated | EXECUTE revocado | PASS | resultados.json#SEC-06 |  |
| SEC-07 | Seguridad y RLS | anon no puede leer citas | esperado=42501 obtenido=42501 mensaje=permission denied for table appointments | PASS | resultados.json#SEC-07 |  |
| SEC-08 | Seguridad y RLS | anon no puede insertar citas | esperado=42501 obtenido=42501 mensaje=permission denied for table appointments | PASS | resultados.json#SEC-08 |  |
| SEC-09 | Seguridad y RLS | anon no puede leer pacientes | esperado=42501 obtenido=42501 mensaje=permission denied for table patients | PASS | resultados.json#SEC-09 |  |
| SEC-10 | Seguridad y RLS | anon no puede leer médicos | esperado=42501 obtenido=42501 mensaje=permission denied for table physicians | PASS | resultados.json#SEC-10 |  |
| SEC-11 | Seguridad y RLS | anon no puede leer el historial | esperado=42501 obtenido=42501 mensaje=permission denied for table appointment_events | PASS | resultados.json#SEC-11 |  |
| SEC-12 | Seguridad y RLS | anon no puede leer bloqueos de agenda | esperado=42501 obtenido=42501 mensaje=permission denied for table physician_schedule_blocks | PASS | resultados.json#SEC-12 |  |
| SEC-13 | Seguridad y RLS | anon no puede ejecutar la confirmación | esperado=42501 obtenido=42501 mensaje=permission denied for function confirm_appointment | PASS | resultados.json#SEC-13 |  |
| SEC-14 | Seguridad y RLS | anon no puede ejecutar la cancelación | esperado=42501 obtenido=42501 mensaje=permission denied for function cancel_appointment | PASS | resultados.json#SEC-14 |  |
| SEC-15 | Seguridad y RLS | anon no puede ejecutar la reprogramación | esperado=42501 obtenido=42501 mensaje=permission denied for function reschedule_appointment | PASS | resultados.json#SEC-15 |  |
| SEC-16 | Seguridad y RLS | Una cuenta sin rol no ve citas | filas=0 | PASS | resultados.json#SEC-16 |  |
| SEC-17 | Seguridad y RLS | Una cuenta sin rol no ve pacientes | filas=0 | PASS | resultados.json#SEC-17 |  |
| SEC-18 | Seguridad y RLS | Una cuenta sin rol no ve médicos | filas=0 | PASS | resultados.json#SEC-18 |  |
| SEC-19 | Seguridad y RLS | Una cuenta sin rol no ve historial | filas=0 | PASS | resultados.json#SEC-19 |  |
| SEC-20 | Seguridad y RLS | Una cuenta sin rol no ve bloqueos | filas=0 | PASS | resultados.json#SEC-20 |  |
| SEC-21 | Seguridad y RLS | Una cuenta sin rol no puede insertar citas | esperado=42501 obtenido=42501 mensaje=new row violates row-level security policy for table "appointments" | PASS | resultados.json#SEC-21 |  |
| SEC-22 | Seguridad y RLS | Una cuenta sin rol no puede insertar bloqueos | esperado=42501 obtenido=42501 mensaje=new row violates row-level security policy for table "physician_schedule_blocks" | PASS | resultados.json#SEC-22 |  |
| SEC-23 | Seguridad y RLS | Una cuenta sin rol no puede confirmar | esperado=42501 obtenido=42501 mensaje=Solo administración o recepción puede modificar citas. | PASS | resultados.json#SEC-23 |  |
| SEC-24 | Seguridad y RLS | Una cuenta sin rol no puede cancelar | esperado=42501 obtenido=42501 mensaje=Solo administración o recepción puede modificar citas. | PASS | resultados.json#SEC-24 |  |
| SEC-25 | Seguridad y RLS | Una cuenta sin rol no puede reprogramar | esperado=42501 obtenido=42501 mensaje=Solo administración o recepción puede modificar citas. | PASS | resultados.json#SEC-25 |  |
| SEC-26 | Seguridad y RLS | Recepción lee toda la agenda | citas=4 | PASS | resultados.json#SEC-26 |  |
| SEC-27 | Seguridad y RLS | Recepción lee pacientes y médicos | pacientes=3 medicos=3 | PASS | resultados.json#SEC-27 |  |
| SEC-28 | Seguridad y RLS | Recepción crea una cita pending | alta autorizada | PASS | resultados.json#SEC-28 |  |
| SEC-29 | Seguridad y RLS | Recepción no puede crear una cita confirmada directamente | esperado=42501 obtenido=42501 mensaje=new row violates row-level security policy for table "appointments" | PASS | resultados.json#SEC-29 |  |
| SEC-30 | Seguridad y RLS | La FK sigue rechazando un paciente inexistente | esperado=23503 obtenido=23503 mensaje=insert or update on table "appointments" violates foreign key constraint "appointments_patient_id_fkey" | PASS | resultados.json#SEC-30 |  |
| SEC-31 | Seguridad y RLS | Recepción no puede actualizar citas directamente | esperado=42501 obtenido=42501 mensaje=permission denied for table appointments | PASS | resultados.json#SEC-31 |  |
| SEC-32 | Seguridad y RLS | Recepción no puede borrar citas directamente | esperado=42501 obtenido=42501 mensaje=permission denied for table appointments | PASS | resultados.json#SEC-32 |  |
| SEC-33 | Seguridad y RLS | Recepción no puede escribir el historial directamente | esperado=42501 obtenido=42501 mensaje=permission denied for table appointment_events | PASS | resultados.json#SEC-33 |  |
| SEC-34 | Seguridad y RLS | Recepción lee todo el historial | eventos=5 | PASS | resultados.json#SEC-34 |  |
| SEC-35 | Seguridad y RLS | Recepción crea un bloqueo de agenda | bloqueo insertado | PASS | resultados.json#SEC-35 |  |
| SEC-36 | Seguridad y RLS | Rechaza un bloqueo que se traslapa con una cita activa | esperado=23P01 obtenido=23P01 mensaje=El bloqueo se traslapa con una cita activa. | PASS | resultados.json#SEC-36 |  |
| SEC-37 | Seguridad y RLS | Rechaza una cita que se traslapa con un bloqueo | esperado=23P01 obtenido=23P01 mensaje=El medico no esta disponible en ese horario. | PASS | resultados.json#SEC-37 |  |
| SEC-38 | Seguridad y RLS | Una cita cancelada no impide bloquear el horario | bloqueo sobre cancelada aceptado | PASS | resultados.json#SEC-38 |  |
| SEC-39 | Seguridad y RLS | Rechaza campos de cancelación en una cita no cancelada | esperado=23514 obtenido=23514 mensaje=new row for relation "appointments" violates check constraint "appointments_cancellation_fields_check" | PASS | resultados.json#SEC-39 |  |
| SEC-40 | Seguridad y RLS | Recepción cancela por RPC y se registra su autoría | estado y actor de la cancelación | PASS | resultados.json#SEC-40 |  |
| SEC-41 | Seguridad y RLS | El médico lee solo sus propias citas | citas_visibles=2 | PASS | resultados.json#SEC-41 |  |
| SEC-42 | Seguridad y RLS | El médico lee solo pacientes con cita propia | pacientes_visibles=1 | PASS | resultados.json#SEC-42 |  |
| SEC-43 | Seguridad y RLS | El médico solo ve su propio registro profesional | medicos_visibles=1 | PASS | resultados.json#SEC-43 |  |
| SEC-44 | Seguridad y RLS | El médico solo ve el historial de sus citas | eventos_visibles=2 | PASS | resultados.json#SEC-44 |  |
| SEC-45 | Seguridad y RLS | El médico no puede confirmar citas | esperado=42501 obtenido=42501 mensaje=Solo administración o recepción puede modificar citas. | PASS | resultados.json#SEC-45 |  |
| SEC-46 | Seguridad y RLS | El médico no puede cancelar citas | esperado=42501 obtenido=42501 mensaje=Solo administración o recepción puede modificar citas. | PASS | resultados.json#SEC-46 |  |
| SEC-47 | Seguridad y RLS | El médico no puede reprogramar citas | esperado=42501 obtenido=42501 mensaje=Solo administración o recepción puede modificar citas. | PASS | resultados.json#SEC-47 |  |
| SEC-48 | Seguridad y RLS | El médico no puede insertar citas directamente | esperado=42501 obtenido=42501 mensaje=new row violates row-level security policy for table "appointments" | PASS | resultados.json#SEC-48 |  |
| SEC-49 | Seguridad y RLS | El médico no puede insertar bloqueos de agenda | esperado=42501 obtenido=42501 mensaje=new row violates row-level security policy for table "physician_schedule_blocks" | PASS | resultados.json#SEC-49 |  |
| SEC-50 | Seguridad y RLS | El médico no puede modificar bloqueos directamente | fila sin cambios | PASS | resultados.json#SEC-50 |  |
| SEC-51 | Seguridad y RLS | El médico no puede borrar bloqueos directamente | fila conservada | PASS | resultados.json#SEC-51 |  |
| SEC-52 | Seguridad y RLS | El médico solo ve sus propios bloqueos | bloqueos_visibles=2 | PASS | resultados.json#SEC-52 | Se ajustó la expectativa de la prueba a los dos bloqueos propios del médico; el esquema y las políticas no cambiaron. |
| SEC-53 | Seguridad y RLS | Un médico no ve citas ni pacientes de otro médico | citas=1 pacientes=1 | PASS | resultados.json#SEC-53 |  |
| SEC-54 | Seguridad y RLS | El evento confirmed guarda al administrador y la transición | autoría y transición comprobadas | PASS | resultados.json#SEC-54 |  |
| SEC-55 | Seguridad y RLS | El evento created de una cita guarda al usuario que la creó | autoría de la creación por recepción | PASS | resultados.json#SEC-55 |  |
| SEC-56 | Seguridad y RLS | El historial no se puede reescribir con UPDATE directo | sin privilegio UPDATE | PASS | resultados.json#SEC-56 |  |
