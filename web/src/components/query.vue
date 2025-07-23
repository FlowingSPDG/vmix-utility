<template>
	<div>
		<el-input style="width:350px;" placeholder="Key" @input="apply()" v-model="InputKey"></el-input>
		<el-input style="width:350px;" placeholder="Value" @input="apply()" v-model="InputValue"></el-input>
	</div>
</template>

<script>
export default {
	name: 'QueryInput',
	model: {
	prop: 'propData',
	event: 'input'
  },
  props: {
	propData: String
  },
	data(){
		return {
			InputKey:'',
			InputValue:''
		}
	},
	methods: {
		apply: function(){
			this.$emit('input', {key:this.InputKey,value:this.InputValue})
		}
	}
}
</script>

<style scoped>

</style>