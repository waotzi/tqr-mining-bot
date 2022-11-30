const groups = document.getElementsByClassName('group')
let secret_api_key = localStorage.getItem("api");

const setApiKey = (e) => {
    secret_api_key = prompt("Enter the secret api key:", "");
    localStorage.setItem("api", secret_api_key);

}

const deselectGroup = (group) => {
    const items = group.getElementsByClassName('item-container')
    Object.keys(items).forEach((i) => {
        let item = items[i];
        item.classList.remove('selected');
    })
} 

const hasClass = (item, c) => {
    if (item.classList.value.includes(c) == true)
        return true
    else
        return false
}
const selectItem = (e) => {
    let item = e.currentTarget
    if (e.target.innerHTML === "red card") {
        if (hasClass(item, 'selected'))
           item.classList.remove('selected') 
        if (hasClass(item, 'red'))
            item.classList.remove('red')
        else
            item.classList.add('red')
        
    }
    else {
        let is_selected = hasClass(item, 'selected')

        deselectGroup(item.myGroup);
        if (hasClass(item, 'red'))
            item.classList.remove('red')
        if (is_selected)
            item.classList.remove('selected') 
        else      
            item.classList.add('selected');
    }
}

const approveSelected = (e) => {
    let selected = []
    let cards = []
    let rejected = []
    Object.keys(groups).forEach((key) => {
        const group = groups[key]
        const items = group.getElementsByClassName('item-container')
  
        Object.keys(items).forEach((i) => {
            let item = items[i];
            if (hasClass(item, 'red'))
                cards.push(item.id)
            else if (hasClass(item, 'selected'))
                selected.push(item.id);
            else
                rejected.push(item.id)
        })
    })


    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/reviewData', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Authorization', 'Bearer ' + secret_api_key)
    xhr.send(JSON.stringify({
        selected, cards, rejected
    }))
    xhr.onload = function() {
        if (xhr.status != 200) { // analyze HTTP status of the response
          alert(`Error ${xhr.status}: ${xhr.statusText}`); // e.g. 404: Not Found
        } else { // show the result
            setTimeout(() => {
                window.location.reload();
            }, 400)    
        }
      };


}

Object.keys(groups).forEach((key) => {
    const group = groups[key]
    const items = group.getElementsByClassName('item-container')
    
    Object.keys(items).forEach((i) => {
        let item = items[i];
        if (i == 0) {
            item.classList.add('selected');
        }
        item.addEventListener("click", selectItem); 
        item.myGroup = group
    })

    /*if (key == 0) {
        val.classList.add("selected")
    }*/
})

const onlyOne = (checkbox) => {
    let name = checkbox.name
    let checkboxes = document.getElementsByName(name)
    checkboxes.forEach((item) => {
        if (item !== checkbox) item.checked = false
    })
}