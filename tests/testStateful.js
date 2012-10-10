define(['dbind/bind', 'dojo/Stateful'], function(bind, Stateful){
        function Model(props) {
            var stateful = new Stateful(props),
                first = bind(stateful, 'first'),
                last = bind(stateful, 'last'),
                fullName = bind(stateful, 'fullName').to(bind(function (first, last) {
                    console.log('making full name', first, last);
                    return [].join.apply(arguments);
                }).to([first, last]));

			fullName.then(function(fullName){
				console.log("The full name is now", fullName);
			});
            return stateful;
        }
            
        model = Model({
            first: 'first',
            last: 'last'
        });
		console.log(model);

        model.set("first", "John");
        model.set("last", "Doe");
        
        console.log("Full name: ", model.fullName);
});