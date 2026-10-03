<template>
  <div class="doctors-page">

    <!-- NAVBAR -->
    

    <!-- PAGE HEADER -->
    <section class="page-header">
      <p class="hero-label">DOCTEX</p>

      <h1>Find a Doctor</h1>

      <p>
        Find doctors by name, specialization or location.
      </p>
    </section>

    <!-- SEARCH -->
    <section class="doctor-search-section">
      <div class="doctor-search-box">

        <input
          v-model="search"
          type="text"
          placeholder="Doctor name or specialization"
          @keyup.enter="searchDoctors"
        />

        <input
          v-model="location"
          type="text"
          placeholder="Location e.g. Lagos"
          @keyup.enter="searchDoctors"
        />

        <button
          type="button"
          class="search-button"
          @click="searchDoctors"
        >
          Search
        </button>

      </div>
    </section>

    <!-- DOCTORS -->
    <section class="doctors-container">

      <div class="doctors-title">
        <h2>Available Doctors</h2>

        <p>
          {{ doctors.length }}
          {{ doctors.length === 1 ? 'doctor' : 'doctors' }}
          available
        </p>
      </div>

      <!-- LOADING -->
      <div v-if="loading" class="loading">
        Loading doctors...
      </div>

      <!-- ERROR -->
      <div v-else-if="error" class="error-message">
        {{ error }}
      </div>

      <!-- EMPTY -->
      <div
        v-else-if="doctors.length === 0"
        class="empty-state"
      >
        No doctors found.
      </div>

      <!-- DOCTOR CARDS -->
      <div v-else class="doctor-grid">

        <article
          v-for="doctor in doctors"
          :key="doctor._id"
          class="doctor-card"
        >

          <img
            class="doctor-image"
            :src="getDoctorImage(doctor)"
            :alt="doctor.name"
          />

          <div class="doctor-card-content">

            <p class="doctor-specialization">
              {{ doctor.specialization }}
            </p>

            <h3>
              {{ doctor.name }}
            </h3>

            <p class="doctor-location">
              📍 {{ doctor.location }}
            </p>

            <p
              v-if="doctor.bio"
              class="doctor-location"
            >
              {{ doctor.bio }}
            </p>

            <router-link
              :to="`/doctors/${doctor._id}`"
              class="view-doctor-button"
            >
              View Profile
            </router-link>

          </div>

        </article>

      </div>

    </section>

  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import api from '../services/api'

const route = useRoute()

const doctors = ref([])
const loading = ref(false)
const error = ref('')

const search = ref(route.query.search || '')
const location = ref('')

const fetchDoctors = async () => {
  loading.value = true
  error.value = ''

  try {
    const params = {}

    if (search.value.trim()) {
      params.search = search.value.trim()
    }

    if (location.value.trim()) {
      params.location = location.value.trim()
    }

    const response = await api.get('/doctors', {
      params
    })

    doctors.value = response.data.data || []
  } catch (err) {
    error.value =
      err.response?.data?.message ||
      'Unable to load doctors right now.'

    doctors.value = []
  } finally {
    loading.value = false
  }
}

const searchDoctors = () => {
  fetchDoctors()
}

const getDoctorImage = (doctor) => {
  return doctor.image
}

onMounted(() => {
  fetchDoctors()
})
</script>