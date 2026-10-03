<template>
  <div class="doctor-profile-setup">
    <main class="profile-setup-container">
      <router-link to="/doctor/dashboard" class="back-link">
        ← Back to Dashboard
      </router-link>

      <div class="profile-setup-header">
        <span class="section-eyebrow">DOCTOR PROFILE</span>
        <h1>Create Your Doctor Profile</h1>
        <p>
          Add your professional information so patients can find you and book
          available appointments.
        </p>
      </div>

      <form class="profile-form" @submit.prevent="createProfile">
        <div v-if="error" class="form-error">
          {{ error }}
        </div>

        <div v-if="success" class="form-success">
          {{ success }}
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label>Doctor Name</label>
            <input
              v-model="form.name"
              type="text"
              placeholder="Enter your name"
              required
            />
          </div>

          <div class="form-group">
            <label>Specialization</label>
            <input
              v-model="form.specialization"
              type="text"
              placeholder="e.g. Dermatology"
              required
            />
          </div>

          <div class="form-group">
            <label>Email</label>
            <input
              v-model="form.email"
              type="email"
              placeholder="Enter your professional email"
              required
            />
          </div>

          <div class="form-group">
            <label>Phone</label>
            <input
              v-model="form.phone"
              type="tel"
              placeholder="Enter your phone number"
              required
            />
          </div>

          <div class="form-group">
            <label>Location</label>
            <input
              v-model="form.location"
              type="text"
              placeholder="e.g. Lagos"
              required
            />
          </div>

          <div class="form-group full-width">
            <label>Bio</label>
            <textarea
              v-model="form.bio"
              rows="5"
              placeholder="Tell patients briefly about your professional background"
              required
            ></textarea>
          </div>
        </div>

        <div class="form-actions">
          <router-link
            to="/doctor/dashboard"
            class="secondary-form-button"
          >
            Cancel
          </router-link>

          <button
            type="submit"
            class="primary-form-button"
            :disabled="loading"
          >
            {{ loading ? 'Creating Profile...' : 'Create Profile' }}
          </button>
        </div>
      </form>
    </main>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../services/api'

const router = useRouter()

const loading = ref(false)
const error = ref('')
const success = ref('')

const storedUser = localStorage.getItem('doctex_user')

let user = null

try {
  user = storedUser ? JSON.parse(storedUser) : null
} catch {
  user = null
}

const form = reactive({
  name: user?.name || '',
  specialization: '',
  email: user?.email || '',
  phone: '',
  location: '',
  bio: ''
})

const createProfile = async () => {
  loading.value = true
  error.value = ''
  success.value = ''

  try {
    await api.post('/doctors', form)

    success.value = 'Doctor profile created successfully.'

    setTimeout(() => {
      router.push('/doctor/dashboard')
    }, 700)
  } catch (err) {
    error.value =
      err.response?.data?.message ||
      'Unable to create your doctor profile.'
  } finally {
    loading.value = false
  }
}
</script>