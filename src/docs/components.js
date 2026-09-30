/**
 * Shared schemas and error envelope for the Doctor Appointment API.
 *
 * @swagger
 * components:
 *   schemas:
 *     Error:
 *       type: object
 *       required: [success, message]
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: Invalid email or password
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: 66f0c1a2b3d4e5f60718293a
 *         name:
 *           type: string
 *           example: Jane Patient
 *         email:
 *           type: string
 *           example: jane@example.com
 *         role:
 *           type: string
 *           enum: [patient, doctor]
 *     AuthResponse:
 *       type: object
 *       required: [success, token, user]
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         token:
 *           type: string
 *           description: Bearer JWT for subsequent requests
 *         user:
 *           $ref: '#/components/schemas/User'
 *     Doctor:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         user:
 *           $ref: '#/components/schemas/User'
 *         name:
 *           type: string
 *           example: Greg House
 *         specialization:
 *           type: string
 *           example: Diagnostics
 *         email:
 *           type: string
 *           example: house@example.com
 *         phone:
 *           type: string
 *           example: +15551234567
 *         location:
 *           type: string
 *           example: Princeton
 *         bio:
 *           type: string
 *     Availability:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         doctor:
 *           type: string
 *           description: Doctor profile id
 *         date:
 *           type: string
 *           format: date-time
 *         startTime:
 *           type: string
 *           example: 09:00
 *         endTime:
 *           type: string
 *           example: 12:00
 *         isBooked:
 *           type: boolean
 *     Appointment:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         patient:
 *           $ref: '#/components/schemas/User'
 *         doctor:
 *           $ref: '#/components/schemas/Doctor'
 *         availability:
 *           $ref: '#/components/schemas/Availability'
 *         appointmentDate:
 *           type: string
 *           format: date-time
 *         startTime:
 *           type: string
 *           example: 09:30
 *         endTime:
 *           type: string
 *           example: 10:00
 *         status:
 *           type: string
 *           enum: [pending, confirmed, cancelled, completed]
 *     Pagination:
 *       type: object
 *       properties:
 *         total:
 *           type: integer
 *         page:
 *           type: integer
 *         limit:
 *           type: integer
 *         pages:
 *           type: integer
 */

module.exports = {};
