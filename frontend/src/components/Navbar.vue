<template>
  <nav class="navbar">
    <router-link to="/" class="logo">
      <span class="logo-icon">♥</span>
      <span>Doctex</span>
    </router-link>

    <div class="nav-links">
      <router-link to="/">
        Home
      </router-link>

      <router-link to="/doctors">
        Find Doctors
      </router-link>

      <router-link
        v-if="user && user.role === 'patient'"
        to="/appointments"
      >
        My Appointments
      </router-link>

      <router-link
        v-if="user && user.role === 'doctor'"
        to="/appointments"
      >
        Appointments
      </router-link>

      <router-link
        v-if="user && user.role === 'doctor'"
        to="/doctor/dashboard"
      >
        Dashboard
      </router-link>
    </div>

    <div class="nav-account">

      <!-- NOT LOGGED IN -->
      <template v-if="!user">

        <router-link
          to="/login"
          class="login-link"
        >
          Login
        </router-link>

        <router-link
          to="/register"
          class="nav-button"
        >
          Register
        </router-link>

      </template>

      <!-- LOGGED IN -->
      <template v-else>

        <div class="user-menu">

          <div class="user-avatar">
            {{ userInitial }}
          </div>

          <div class="user-details">
            <strong>
              {{ user.name }}
            </strong>

            <span>
              {{ formattedRole }}
            </span>
          </div>

          <button
            type="button"
            class="logout-button"
            @click="logout"
          >
            Logout
          </button>

        </div>

      </template>

    </div>
  </nav>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const user = ref(null)

const loadUser = () => {
  const storedUser = localStorage.getItem('doctex_user')

  if (!storedUser) {
    user.value = null
    return
  }

  try {
    user.value = JSON.parse(storedUser)
  } catch {
    user.value = null
  }
}

loadUser()

watch(
  () => route.fullPath,
  () => {
    loadUser()
  }
)

const userInitial = computed(() => {
  if (!user.value?.name) return '?'

  return user.value.name.charAt(0).toUpperCase()
})

const formattedRole = computed(() => {
  if (!user.value?.role) return ''

  return user.value.role === 'doctor'
    ? 'Doctor'
    : 'Patient'
})

const logout = () => {
  localStorage.removeItem('doctex_token')
  localStorage.removeItem('doctex_user')

  user.value = null

  router.push('/')
}
</script>