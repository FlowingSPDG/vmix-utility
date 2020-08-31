<script>
export default {
  name: "api",
  methods: {
    async GetvMixAddr() {
      try {
        const res = await this.axios.get("/api/vmix");
        return res.data.url;
      } catch (err) {
        throw new Error(err);
      }
    },
    async GetInputs() {
      try {
        const res = await this.axios.get("/api/inputs");
        return res.data.inputs;
      } catch (err) {
        throw new Error(err);
      }
    },
    async RefreshInput() {
      try {
        const res = await this.axios.post("/api/refresh");
        return res.data.inputs;
      } catch (err) {
        throw new Error(err);
      }
    },
    async TryFunction(url){
      try{
        await this.axios.get(url);
        await this.$notify({
          title: "Success",
          message: `Success GET Request on ${url}`,
          type: "success"
        });
      }catch(err){
        this.$notify.error({
          title: "Error",
          message: err
        })
      }
    }
  }
};
</script>