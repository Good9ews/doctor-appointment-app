<template>
  <div class="home-page">

    <!-- NAVBAR -->
    

    <!-- HERO -->
    <section class="hero">
      <div class="hero-content">
        <div class="hero-label">
          WELCOME TO DOCTEX
        </div>

        <h1>
          Find the Right Doctor
          <br />
          for Your Health
        </h1>

        <p>
          Find doctors, view their availability and book appointments
          in one place.
        </p>

        <form class="hero-search" @submit.prevent="goToDoctors">
          <input
            v-model="search"
            type="text"
            placeholder="Search doctor or specialization"
          />

          <button type="submit">
            Search
          </button>
        </form>
      </div>
    </section>

    <!-- HOW IT WORKS -->
    <section id="how-it-works" class="features">
      <div class="section-heading">
        <h2>How Doctex Works</h2>
        <p>
          Find a doctor, check available appointment times and book
          your appointment easily.
        </p>
      </div>

      <div class="feature-grid">

        <div class="feature-card">
          <div class="feature-icon">
            👨‍⚕️
          </div>

          <h3>Find Doctors</h3>

          <p>
            Search and find doctors by name, specialization or location.
          </p>
        </div>

        <div class="feature-card">
          <div class="feature-icon">
            📅
          </div>

          <h3>View Availability</h3>

          <p>
            View available appointment slots for your selected doctor.
          </p>
        </div>

        <div class="feature-card">
          <div class="feature-icon">
            ✓
          </div>

          <h3>Book Appointment</h3>

          <p>
            Choose an available time and book your appointment easily.
          </p>
        </div>

      </div>
    </section>

    <!-- ABOUT -->
    <section id="about" class="about-section">
      <div class="about-container">

        <img
          class="about-image"
          src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=1000&q=85"
          alt="Doctor"
        />

        <div class="about-content">
          <div class="hero-label">
            ABOUT DOCTEX
          </div>

          <h2>
            Healthcare appointments,
            made simple.
          </h2>

          <p>
            Doctex helps patients find doctors, view available
            appointment times and book appointments through one
            simple platform.
          </p>

          <p>
            Patients can search for doctors, check their availability
            and choose an appointment time that works for them.
          </p>

          <router-link to="/doctors" class="view-doctor-button">
            Find a Doctor
          </router-link>
        </div>

      </div>
    </section>

  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const search = ref('')

const goToDoctors = () => {
  if (search.value.trim()) {
    router.push({
      path: '/doctors',
      query: {
        search: search.value.trim()
      }
    })
  } else {
    router.push('/doctors')
  }
}
</script>