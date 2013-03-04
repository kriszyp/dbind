define(["./bind"], function(bind){
	var qsa,
		undef,
		Binding = bind.Binding,
		ElementBinding = bind.Element,
		inlineTemplateType = "dbind/InlineTemplate";

	function InlineTemplateBinding(){
		Binding.apply(this, arguments);
	}
	InlineTemplateBinding.prototype = new Binding();
	InlineTemplateBinding.prototype.create = function(element){
		if(element){
			var nodes = (qsa = qsa === undef ? !!element.querySelectorAll : qsa) ? element.querySelectorAll("script[type='" + inlineTemplateType + "']") : element.getElementsByTagName("script"),
				templates = [];
			for(var i = 0, l = nodes.length; i < l; ++i){
				if(qsa || nodes[i].getAttribute("type") == inlineTemplateType){
					var node = nodes[i];
					templates.push(node.innerHTML.replace(/^\s+/, "").replace(/\s+$/, ""));
					node.parentNode.removeChild(node);
				}
			}
			this.getValue = function(callback){
				callback(templates.join(""));
			};
			this.setValue = function(){};
		}
		Binding.prototype.create.call(this);
	};

	var origGet = ElementBinding.prototype.get;
	ElementBinding.prototype.get = function(key){
		this['_' + key] || key == "template" && (this['_' + key] = this.own(new InlineTemplateBinding(this.object))[0]);
		return origGet.apply(this, arguments);
	};

	bind.InlineTemplate = InlineTemplateBinding;
	return bind;
});
