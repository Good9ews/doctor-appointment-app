<template>
  <div class="appointments-page-wrapper">
    

    <section class="appointments-hero">
      <div>
        <span class="section-eyebrow">YOUR APPOINTMENTS</span>
        <h1>My Appointments</h1>
        <p>View and manage your booked doctor appointments.</p>
      </div>

      <div class="appointment-hero-icon">
        <span>▣</span>
        <small>✓</small>
      </div>
    </section>

    <main class="appointments-container">
      <div class="appointment-tabs">
        <button
          :class="{ active: selectedTab === 'all' }"
          @click="selectedTab = 'all'"
        >
          All Appointments
          <span>{{ appointments.length }}</span>
        </button>

        <button
          :class="{ active: selectedTab === 'pending' }"
          @click="selectedTab = 'pending'"
        >
          Pending
          <span>{{ countByStatus('pending') }}</span>
        </button>

        <button
          :class="{ active: selectedTab === 'confirmed' }"
          @click="selectedTab = 'confirmed'"
        >
          Confirmed
          <span>{{ countByStatus('confirmed') }}</span>
        </button>

        <button
          :class="{ active: selectedTab === 'completed' }"
          @click="selectedTab = 'completed'"
        >
          Completed
          <span>{{ countByStatus('completed') }}</span>
        </button>

        <button
          :class="{ active: selectedTab === 'cancelled' }"
          @click="selectedTab = 'cancelled'"
        >
          Cancelled
          <span>{{ countByStatus('cancelled') }}</span>
        </button>
      </div>

      <div v-if="loading" class="appointments-loading">
        <div class="loading-spinner"></div>
        <p>Loading your appointments...</p>
      </div>

      <div v-else-if="error" class="appointments-error">
        <strong>Unable to load appointments</strong>
        <p>{{ error }}</p>
        <button class="primary-button" @click="loadAppointments">
          Try Again
        </button>
      </div>

      <div v-else-if="filteredAppointments.length === 0" class="empty-appointments">
        <div class="empty-icon">▣</div>
        <h2>No appointments found</h2>
        <p>
          You don't have any
          {{ selectedTab === 'all' ? '' : selectedTab }}
          appointments yet.
        </p>

        <router-link to="/doctors" class="primary-button">
          Find a Doctor
        </router-link>
      </div>

      <div v-else class="appointments-list">
        <article
          v-for="appointment in filteredAppointments"
          :key="appointment._id"
          class="appointment-card"
        >
          <div class="doctor-summary">
            <div class="doctor-avatar">
              <span>♙</span>
            </div>

            <div class="doctor-info">
              <h2>
                {{ appointment.doctor?.name || 'Doctor' }}
              </h2>

              <p class="specialization">
                {{ appointment.doctor?.specialization || 'Medical Doctor' }}
              </p>

              <p
                v-if="appointment.doctor?.location"
                class="doctor-location"
              >
                <span>⌖</span>
                {{ appointment.doctor.location }}
              </p>
            </div>
          </div>

          <div class="appointment-detail">
            <span class="detail-label">DATE</span>
            <strong>{{ formatDate(appointment.appointmentDate) }}</strong>
          </div>

          <div class="appointment-detail">
            <span class="detail-label">TIME</span>
            <strong>
              {{ appointment.startTime }} - {{ appointment.endTime }}
            </strong>
          </div>

          <div class="appointment-actions">
            <span
              class="status-badge"
              :class="`status-${appointment.status}`"
            >
              <span class="status-dot"></span>
              {{ capitalize(appointment.status) }}
            </span>

            <router-link
              v-if="appointment.doctor?._id"
              :to="`/doctors/${appointment.doctor._id}`"
              class="outline-button"
            >
              View Doctor
            </router-link>

            <button
              v-if="
                appointment.status !== 'cancelled' &&
                appointment.status !== 'completed'
              "
              class="cancel-button"
              @click="cancelAppointment(appointment._id)"
            >
              Cancel Appointment
            </button>
          </div>
        </article>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import api from '../services/api'

const appointments = ref([])
const loading = ref(true)
const error = ref('')
const selectedTab = ref('all')

const loadAppointments = async () => {
  loading.value = true
  error.value = ''

  try {
    const response = await api.get('/appointments')

    appointments.value =
      response.data.data ||
      response.data.appointments ||
      []
  } catch (err) {
    error.value =
      err.response?.data?.message ||
      'Unable to load your appointments.'
  } finally {
    loading.value = false
  }
}

const filteredAppointments = computed(() => {
  if (selectedTab.value === 'all') {
    return appointments.value
  }

  return appointments.value.filter(
    appointment => appointment.status === selectedTab.value
  )
})

const countByStatus = status => {
  return appointments.value.filter(
    appointment => appointment.status === status
  ).length
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

const capitalize = value => {
  if (!value) return ''

  return value.charAt(0).toUpperCase() + value.slice(1)
}

const cancelAppointment = async appointmentId => {
  const confirmed = window.confirm(
    'Are you sure you want to cancel this appointment?'
  )

  if (!confirmed) return

  try {
    await api.patch(`/appointments/${appointmentId}/cancel`)
    await loadAppointments()
  } catch (err) {
    window.alert(
      err.response?.data?.message ||
      'Unable to cancel this appointment.'
    )
  }
}

onMounted(loadAppointments)
</script>