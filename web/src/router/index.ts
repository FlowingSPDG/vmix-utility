import Vue from 'vue'
import VueRouter from 'vue-router'
import Home from '../views/Home.vue'
import Developer from '../views/Developer.vue'
import Tree from '../views/Tree.vue'
import api from '../utils/api.vue'

Vue.use(VueRouter)

// Mixin ./utils/api.vue
Vue.mixin(api)

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/tree',
    name: 'Tree',
    component: Tree
  },
  {
    path: '/developer',
    name: 'Developer',
    component: Developer
  }
]

const router = new VueRouter({
  routes
})

export default router
