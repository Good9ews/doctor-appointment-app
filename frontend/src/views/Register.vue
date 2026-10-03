<template>
  <div>
   
    <main class="auth-page">
      <div class="auth-card">
        <h1>Create Account</h1>
        <p>Join Doctex today</p>

        <div v-if="error" class="error-message">
          {{ error }}
        </div>

        <form @submit.prevent="register">
          <div class="form-group">
            <label>Full Name</label>
            <input
              v-model="form.name"
              type="text"
              placeholder="Enter your full name"
              required
            />
          </div>

          <div class="form-group">
            <label>Email</label>
            <input
              v-model="form.email"
              type="email"
              placeholder="Enter your email"
              required
            />
          </div>

          <div class="form-group">
            <label>Password</label>
            <input
              v-model="form.password"
              type="password"
              placeholder="Minimum 8 characters"
              minlength="8"
              required
            />
          </div>

          <div class="form-group">
            <label>Account Type</label>
            <select v-model="form.role" required>
              <option value="patient">Patient</option>
              <option value="doctor">Doctor</option>
            </select>
          </div>

          <button
            class="primary-button"
            type="submit"
            :disabled="loading"
          >
            {{ loading ? 'Creating account...' : 'Create Account' }}
          </button>
        </form>

        <div class="auth-link">
          Already have an account?
          <router-link to="/login">Sign in</router-link>
        </div>
      </div>
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

const form = reactive({
  name: '',
  email: '',
  password: '',
  role: 'patient'
})

const register = async () => {
  error.value = ''
  loading.value = true

  try {
    const response = await api.post('/auth/register', form)

    localStorage.setItem('doctex_token', response.data.token)
    localStorage.setItem(
      'doctex_user',
      JSON.stringify(response.data.user)
    )

    if (response.data.user.role === 'doctor') {
      router.push('/doctor/dashboard')
    } else {
      router.push('/doctors')
    }
  } catch (err) {
    error.value =
      err.response?.data?.message ||
      'Unable to create your account.'
  } finally {
    loading.value = false
  }
}
</script>