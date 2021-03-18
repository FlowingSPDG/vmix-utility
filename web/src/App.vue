<template>
  <div id="app">
    <div id="nav">
      <el-button round icon="el-icon-s-home" @click="JumpTo('/')">Home</el-button>
      <el-button round icon="el-icon-s-operation" @click="JumpTo('/tree')">Input Menu</el-button>
      <el-button round icon="el-icon-circle-plus" @click="JumpTo('/blank-gen')">Blank Generator</el-button>
      <el-button round icon="el-icon-user-solid" @click="JumpTo('/developer')">Developer</el-button>
      <el-button round icon="el-icon-link" @click="moveLink('https://www.vmix.com/help24/index.htm?ShortcutFunctionReference.html')">vMix Reference</el-button>
    </div>
    <router-view/>
  </div>
</template>

<script>
export default {
  methods: {
    JumpTo: function(url){
      this.$router.push(url)
    },
    moveLink (url) {      
        this.$confirm(`外部サイトを開きます。よろしいですか？`, 'Warning', {
          confirmButtonText: 'OK',
          cancelButtonText: 'Cancel',
          type: 'warning'
        }).then(() => {
          window.open(url, '_blank')
        });
    }
  }
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-left: 15%;
  margin-right: 15%;
}

#nav {
  padding: 30px;
}

#nav a {
  font-weight: bold;
  color: #2c3e50;
}

#nav a.router-link-exact-active {
  color: #42b983;
}
</style>
