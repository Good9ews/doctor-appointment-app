<template>
  <div class="booking-page-wrapper">
   

    <main class="booking-container">
      <router-link
        v-if="doctorId"
        :to="`/doctors/${doctorId}`"
        class="back-link"
      >
        ← Back to Doctor Profile
      </router-link>

      <div class="booking-heading">
        <span class="section-eyebrow">APPOINTMENT BOOKING</span>
        <h1>Book Appointment</h1>

        <p v-if="doctor">
          Select your available appointment with
          <strong>{{ doctor.name }}</strong>.
        </p>
      </div>

      <div v-if="loading" class="booking-loading">
        <div class="loading-spinner"></div>
        <p>Loading appointment details...</p>
      </div>

      <div v-else-if="error" class="booking-error">
        {{ error }}
      </div>

      <div v-else class="booking-layout">
        <!-- Left side -->
        <section class="booking-main-card">
          <div class="booking-card-header">
            <div class="booking-header-icon">▣</div>

            <div>
              <h2>Select Date & Time</h2>
              <p>Choose the available appointment slot.</p>
            </div>
          </div>

          <div class="selected-slot">
            <div class="slot-icon">▣</div>

            <div class="slot-information">
              <span class="slot-label">AVAILABLE SLOT</span>

              <h3>
                {{ formatDate(slot?.date) }}
              </h3>

              <p v-if="slot">
                {{ slot.startTime }} - {{ slot.endTime }}
              </p>
            </div>

            <span class="available-badge">
              Available
            </span>
          </div>

          <div class="booking-notice">
            <span>✓</span>
            <p>
              This appointment time is currently available. Confirm your
              booking to reserve this slot.
            </p>
          </div>
        </section>

        <!-- Right side -->
        <aside class="booking-summary">
          <div class="summary-header">
            <span class="summary-icon">▣</span>
            <h2>Appointment Summary</h2>
          </div>

          <div v-if="doctor" class="summary-doctor">
            <div class="doctor-avatar">
              <span>♙</span>
            </div>

            <div>
              <h3>{{ doctor.name }}</h3>
              <p>{{ doctor.specialization }}</p>

              <span v-if="doctor.location" class="summary-location">
                ⌖ {{ doctor.location }}
              </span>
            </div>
          </div>

          <div class="summary-divider"></div>

          <div class="summary-row">
            <span class="summary-row-icon">▣</span>

            <div>
              <small>Date</small>
              <strong>
                {{ formatDate(slot?.date) }}
              </strong>
            </div>
          </div>

          <div class="summary-row">
            <span class="summary-row-icon">◷</span>

            <div>
              <small>Time</small>
              <strong v-if="slot">
                {{ slot.startTime }} - {{ slot.endTime }}
              </strong>
            </div>
          </div>

          <div class="summary-row">
            <span class="summary-row-icon">♙</span>

            <div>
              <small>Patient</small>
              <strong>Your Account</strong>
            </div>
          </div>

          <div class="summary-divider"></div>

          <div class="booking-status">
            <small>Booking Status</small>
            <span>
              <span class="status-dot"></span>
              Pending
            </span>
          </div>

          <button
            class="confirm-booking-button"
            :disabled="booking || !slot"
            @click="confirmBooking"
          >
            <span v-if="booking" class="button-spinner"></span>
            <span v-else>▣</span>

            {{ booking ? 'Booking...' : 'Confirm Appointment' }}
          </button>
        </aside>
      </div>
    </main>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../services/api'

const route = useRoute()
const router = useRouter()

const doctorId = route.query.doctorId
const availabilityId = route.query.availabilityId

const doctor = ref(null)
const slot = ref(null)
const loading = ref(true)
const booking = ref(false)
const error = ref('')

const loadBookingDetails = async () => {
  if (!doctorId || !availabilityId) {
    error.value = 'Invalid appointment information.'
    loading.value = false
    return
  }

  try {
    const [doctorResponse, availabilityResponse] = await Promise.all([
      api.get(`/doctors/${doctorId}`),
      api.get(`/availability/doctor/${doctorId}`)
    ])

    doctor.value =
      doctorResponse.data.data ||
      doctorResponse.data.doctor ||
      doctorResponse.data

    const availability =
      availabilityResponse.data.data ||
      availabilityResponse.data.availability ||
      availabilityResponse.data

    const slots = Array.isArray(availability)
      ? availability
      : []

    slot.value = slots.find(
      item => item._id === availabilityId
    )

    if (!slot.value) {
      error.value = 'This appointment slot is no longer available.'
    }
  } catch (err) {
    error.value =
      err.response?.data?.message ||
      'Unable to load appointment details.'
  } finally {
    loading.value = false
  }
}

const formatDate = date => {
  if (!date) return '—'

  const parsedDate = new Date(date)

  if (Number.isNaN(parsedDate.getTime())) {
    return date
  }

  return parsedDate.toLocaleDateString('en-US', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

const confirmBooking = async () => {
  if (!slot.value) return

  const token = localStorage.getItem('doctex_token')

  if (!token) {
    router.push({
      path: '/login',
      query: {
        redirect: `/book-appointment?doctorId=${doctorId}&availabilityId=${availabilityId}`
      }
    })

    return
  }

  booking.value = true
  error.value = ''

  try {
    await api.post('/appointments', {
      doctorId,
      availabilityId,
      appointmentDate: slot.value.date,
      startTime: slot.value.startTime,
      endTime: slot.value.endTime
    })

    router.push('/appointments')
  } catch (err) {
    error.value =
      err.response?.data?.message ||
      'Unable to book this appointment.'
  } finally {
    booking.value = false
  }
}

onMounted(loadBookingDetails)
</script>