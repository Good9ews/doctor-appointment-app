<template>
  <div>
  

    <main class="auth-page">
      <div class="auth-card">
        <h1>Welcome Back</h1>
        <p>Sign in to your Doctex account</p>

        <div v-if="error" class="error-message">
          {{ error }}
        </div>

        <form @submit.prevent="login">
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
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            class="primary-button"
            type="submit"
            :disabled="loading"
          >
            {{ loading ? 'Signing in...' : 'Sign In' }}
          </button>
        </form>

        <div class="auth-link">
          Don't have an account?
          <router-link to="/register">Create one</router-link>
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
  email: '',
  password: ''
})

const login = async () => {
  error.value = ''
  loading.value = true

  try {
    const response = await api.post('/auth/login', form)

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
      'Unable to sign in. Please check your details.'
  } finally {
    loading.value = false
  }
}
</script>