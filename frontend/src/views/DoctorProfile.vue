<template>
  <div class="profile-page">

    <!-- NAVBAR -->
    

    <!-- PAGE HEADER -->
    <section class="page-header">
      <p class="hero-label">DOCTEX</p>

      <h1>Doctor Profile</h1>

      <p>
        View doctor information and available appointment times.
      </p>
    </section>

    <main class="profile-container">

      <!-- INVALID ID -->
      <div v-if="invalidId" class="error-message">
        Invalid doctor profile.
      </div>

      <!-- LOADING -->
      <div v-else-if="loading" class="loading">
        Loading doctor profile...
      </div>

      <!-- ERROR -->
      <div v-else-if="error" class="error-message">
        {{ error }}
      </div>

      <!-- DOCTOR PROFILE -->
      <template v-else-if="doctor">

        <section class="profile-card">

          <img
            class="profile-image"
            :src="getDoctorImage()"
            :alt="doctor.name"
          />

          <div class="profile-info">

            <p class="profile-specialization">
              {{ doctor.specialization }}
            </p>

            <h1>{{ doctor.name }}</h1>

            <p>
              <strong>Location:</strong>
              {{ doctor.location }}
            </p>

            <p v-if="doctor.phone">
              <strong>Phone:</strong>
              {{ doctor.phone }}
            </p>

            <p v-if="doctor.email">
              <strong>Email:</strong>
              {{ doctor.email }}
            </p>

            <p v-if="doctor.bio">
              {{ doctor.bio }}
            </p>

          </div>

        </section>

        <!-- AVAILABILITY -->
        <section class="availability-section">

          <h2>Available Appointment Times</h2>

          <div v-if="availabilityLoading" class="loading">
            Loading availability...
          </div>

          <div
            v-else-if="availabilityError"
            class="error-message"
          >
            {{ availabilityError }}
          </div>

          <div
            v-else-if="doctorAvailability.length === 0"
            class="empty-state"
          >
            No available appointment times for this doctor.
          </div>

          <div v-else class="availability-grid">

            <div
  v-for="slot in doctorAvailability"
  :key="slot._id"
  class="availability-card"
  :class="{ 'booked-slot': slot.isBooked }"
>
  <strong>{{ formatDate(slot.date) }}</strong>

  <span>{{ slot.startTime }} - {{ slot.endTime }}</span>

  <button
    class="book-button"
    :class="{ 'booked-button': slot.isBooked }"
    :disabled="slot.isBooked"
    @click="bookAppointment(slot)"
  >
    {{ slot.isBooked ? 'Booked' : 'Book Appointment' }}
  </button>
</div>

          </div>

        </section>

      </template>

    </main>

  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../services/api'

const route = useRoute()
const router = useRouter()

const doctor = ref(null)
const availability = ref([])

const loading = ref(true)
const availabilityLoading = ref(false)

const error = ref('')
const availabilityError = ref('')

const doctorId = computed(() => String(route.params.id || ''))

const isValidMongoId = (id) => {
  return /^[0-9a-fA-F]{24}$/.test(id)
}

const invalidId = computed(() => {
  return !isValidMongoId(doctorId.value)
})

const fetchDoctor = async () => {
  loading.value = true
  error.value = ''

  try {
    const response = await api.get(
      `/doctors/${doctorId.value}`
    )

    doctor.value = response.data.data
  } catch (err) {
    error.value =
      err.response?.data?.message ||
      'Unable to load this doctor.'
  } finally {
    loading.value = false
  }
}

const fetchAvailability = async () => {
  availabilityLoading.value = true
  availabilityError.value = ''

  try {
    const response = await api.get(
      `/availability/doctor/${doctorId.value}`
    )

    availability.value = response.data.data || []
  } catch (err) {
    availabilityError.value =
      err.response?.data?.message ||
      'Unable to load doctor availability.'

    availability.value = []
  } finally {
    availabilityLoading.value = false
  }
}

const doctorAvailability = computed(() => {
  return availability.value
})

const formatDate = (date) => {
  if (!date) return ''

  return new Date(date).toLocaleDateString('en-NG', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

const getDoctorImage = () => {
  return (
    doctor.value?.image ||
    'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=600&q=80'
  )
}

const bookAppointment = (slot) => {
  const token = localStorage.getItem('doctex_token')

  if (!token) {
    router.push({
      path: '/login',
      query: {
        redirect: `/doctors/${doctorId.value}`
      }
    })

    return
  }

  router.push({
    path: '/book-appointment',
    query: {
      doctorId: doctorId.value,
      availabilityId: slot._id
    }
  })
}

onMounted(async () => {
  if (invalidId.value) {
    loading.value = false
    return
  }

  await fetchDoctor()

  if (doctor.value) {
    await fetchAvailability()
  }
})
</script>