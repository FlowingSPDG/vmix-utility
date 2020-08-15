<template>
  <div class="program">
    <h1>Program Monitor(experimental)</h1>
    <p>Playing RTMP Program from {{host}} </p>
    <el-input v-model="StreamKey"></el-input>
    <video id="rtmp_mytv_mytv" class="video-js vjs-default-skin" controls preload="auto" width="1280" height="720" data-setup='{}'>
       <source :src="`rtmp://${host}:1935/${StreamKey}`" type='rtmp/mp4' />
     </video>
  </div>
</template>

<script>
export default {
    data () {
    return {
        StreamKey:"vmu",
        host: location.hostname
    }
  }
}
</script>